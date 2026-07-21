// services/carga-masiva.service.js
const AdmZip = require("adm-zip");
const fs = require("fs").promises;
const path = require("path");
const Autorizacion = require("../../explorer/models/autorizacion.model");
const Municipio = require("../../municipios/models/municipio.model");
const Modalidad = require("../../explorer/models/Modalidad.model");
const TiposAutorizacion = require("../../explorer/models/TiposAutorizacion.model");
const Documento = require("../../explorer/models/documento.model");
const ArchivoDigital = require("../../explorer/models/archivo-digital.model");
const User = require("../../users/models/user.model");
const crypto = require("crypto");
const { Op } = require("sequelize");
const OCRProcessorService = require("./ocr-processor.service");
const OCRProceso = require("../../digitalizacion/models/ocr-proceso.model");
const {
  UserMunicipalityPermission,
  Permission,
  Role,
} = require("../../../database/associations");

class CargaMasivaService {
  constructor() {
    this.autorizacionModel = Autorizacion;
    this.municipioModel = Municipio;
    this.modalidadModel = Modalidad;
    this.tiposAutorizacionModel = TiposAutorizacion;
    this.documentoModel = Documento;
    this.archivoDigitalModel = ArchivoDigital;
    this.ocrProcesoModel = OCRProceso;
  }

  // NUEVA FUNCIÓN: Pre-validar permisos territoriales ("subir") en lote
  async validarPermisosBatch(
    archivosParsed,
    userId,
    checkNomenclatureSkip = false,
  ) {
    // 1. Es Administrador?
    const user = await User.findByPk(userId, {
      include: [
        { model: Role, as: "roles", where: { id: 1 }, required: false },
      ],
    });
    const isAdmin = user.roles && user.roles.length > 0;
    if (isAdmin) return { success: true };

    // 2. Extraer municipios únicos del batch
    const municipiosNecesarios = new Set();
    for (const archivo of archivosParsed) {
      if (archivo.municipioNum)
        municipiosNecesarios.add(parseInt(archivo.municipioNum, 10));
      else if (checkNomenclatureSkip) municipiosNecesarios.add(85); // fallback para SP-N
    }

    // Si requiere bypass nomenclature y no es admin, exigimos explícitamente el 85
    if (checkNomenclatureSkip) {
      municipiosNecesarios.add(85);
    }

    if (municipiosNecesarios.size === 0) return { success: true };

    // 3. Buscar IDs reales de municipios a partir del "num" (si vienen como num)
    const municipiosDocs = await this.municipioModel.findAll({
      where: { num: { [Op.in]: Array.from(municipiosNecesarios) } },
    });
    const mapNumToId = {};
    municipiosDocs.forEach((m) => {
      mapNumToId[m.num] = m.id;
    });

    // 4. Checar permisos del usuario (que tenga el permiso 'subir' en esos IDs)
    const idsRequeridos = Array.from(municipiosNecesarios)
      .map((num) => mapNumToId[num])
      .filter(Boolean);

    if (idsRequeridos.length === 0) {
      return {
        success: false,
        message: "Municipios destino inválidos no encontrados en la base.",
      };
    }

    const permisosEncontrados = await UserMunicipalityPermission.findAll({
      where: {
        user_id: userId,
        municipio_id: { [Op.in]: idsRequeridos },
        active: true,
      },
      include: [
        {
          model: Permission,
          as: "permission",
          where: { name: "subir", active: true },
        },
      ],
    });

    const municipiosAutorizados = new Set(
      permisosEncontrados.map((p) => p.municipio_id),
    );

    for (const idReq of idsRequeridos) {
      if (!municipiosAutorizados.has(idReq)) {
        return {
          success: false,
          message: `Acceso denegado: No tienes permisos de 'subir' para uno o más municipios en este lote de archivos.`,
        };
      }
    }

    return { success: true };
  }

  // Extraer archivos de ZIP/RAR
  async extraerArchivosComprimidos(archivoBuffer, extension) {
    try {
      const archivos = [];
      const tempDir = path.join(process.cwd(), "temp", Date.now().toString());

      await fs.mkdir(tempDir, { recursive: true });

      if (extension === ".zip") {
        const zip = new AdmZip(archivoBuffer);
        zip.extractAllTo(tempDir, true);
      } else if (extension === ".rar") {
        // Para RAR necesitarías una librería como unrar
        throw new Error("Formato RAR no soportado actualmente");
      }

      // Recorrer estructura de carpetas
      const leerCarpetasRecursivamente = async (dir, basePath = "") => {
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          const relativePath = path.join(basePath, item.name);

          if (item.isDirectory()) {
            await leerCarpetasRecursivamente(fullPath, relativePath);
          } else if (
            item.isFile() &&
            item.name.toLowerCase().endsWith(".pdf")
          ) {
            const buffer = await fs.readFile(fullPath);
            archivos.push({
              nombre: item.name,
              buffer: buffer,
              rutaRelativa: relativePath,
              tamano: buffer.length,
              extension: path.extname(item.name),
            });
          }
        }
      };

      await leerCarpetasRecursivamente(tempDir);

      // Limpiar directorio temporal
      await fs.rm(tempDir, { recursive: true, force: true });

      return archivos;
    } catch (error) {
      throw new Error(`Error al extraer archivos: ${error.message}`);
    }
  }

  parsearNombreArchivo(nombreArchivo) {
    try {
      const nombreSinExtension = nombreArchivo.replace(/\.pdf$/i, "");
      const nombreSinPaginas = nombreSinExtension.replace(
        /\s*\(\d+\s*(pag\.?)?\)$/i,
        "",
      );

      // Regex robusta para capturar: AuthNum | Muni | Mod | Cons1 | Cons2 | Tipo (opcional)
      // separador puede ser espacio, guion o guion bajo
      const regex =
        /^(\d+)[_\s-]+(\d+)[_\s-]+(\d+)[_\s-]+(\d+)[_\s-]+(\d+)[_\s-]*([a-zA-Z]+)?/i;
      const match = nombreSinPaginas.match(regex);

      if (!match) {
        throw new Error(`Formato de nombre inválido: ${nombreArchivo}`);
      }

      const numeroAutorizacion = match[1];
      // Asegurarnos de usar 2 dígitos donde corresponde y 3 donde corresponde
      const muni = match[2].padStart(2, "0");
      const mod = match[3].padStart(2, "0");
      const c1 = match[4].padStart(2, "0");
      const c2 = match[5].padStart(3, "0");
      const tipoAbrev = match[6] ? match[6].toUpperCase() : null;

      const bloqueNumerico = `${muni}-${mod}-${c1}-${c2}`; // manteniéndolo como en la BBDD para no romper

      return {
        numeroAutorizacion,
        bloqueNumerico,
        municipioNum: parseInt(muni, 10),
        modalidadNum: parseInt(mod, 10),
        consecutivo1: c1,
        consecutivo2: c2,
        tipoAbrev,
        nombreOriginal: nombreArchivo,
      };
    } catch (error) {
      throw new Error(
        `Error parseando archivo ${nombreArchivo}: ${error.message}`,
      );
    }
  }

  // services/carga-masiva.service.js
  // services/carga-masiva.service.js
  // En el método buscarOCrearAutorizacion:
  async buscarOCrearAutorizacion(datosArchivo, userId) {
    console.log(datosArchivo);
    console.log("datosArchivo");

    const transaction = await this.autorizacionModel.sequelize.transaction();

    try {
      // Buscar municipio por número
      const municipio = await this.municipioModel.findOne({
        where: { num: datosArchivo.municipioNum },
      });

      if (!municipio) {
        throw new Error(
          `Municipio con número ${datosArchivo.municipioNum} no encontrado`,
        );
      }

      // Buscar modalidad por número
      const modalidad = await this.modalidadModel.findOne({
        where: { num: datosArchivo.modalidadNum },
      });

      if (!modalidad) {
        throw new Error(
          `Modalidad con número ${datosArchivo.modalidadNum} no encontrada`,
        );
      }

      // Buscar tipo de autorización por abreviatura
      const tipoAutorizacion = await this.tiposAutorizacionModel.findOne({
        where: { abreviatura: datosArchivo.tipoAbrev },
      });

      if (!tipoAutorizacion) {
        throw new Error(
          `Tipo de autorización con abreviatura ${datosArchivo.tipoAbrev} no encontrado`,
        );
      }

      // **MODIFICACIÓN: Buscar autorización por la combinación de datos**
      let autorizacion = await this.autorizacionModel.findOne({
        where: {
          municipioId: municipio.id,
          modalidadId: modalidad.id,
          tipoId: tipoAutorizacion.id,
          consecutivo1: datosArchivo.consecutivo1,
          consecutivo2: datosArchivo.consecutivo2,
        },
        transaction,
      });

      if (!autorizacion) {
        try {
          autorizacion = await this.autorizacionModel.create(
            {
              // No pasar numeroAutorizacion - dejar que el trigger lo genere
              numeroAutorizacion: datosArchivo.numeroAutorizacion,
              municipioId: municipio.id,
              modalidadId: modalidad.id,
              tipoId: tipoAutorizacion.id,
              consecutivo1: datosArchivo.consecutivo1,
              consecutivo2: datosArchivo.consecutivo2,
              activo: true,
              fechaCreacion: new Date(),
              fechaSolicitud: new Date(),
            },
            {
              transaction,
              returning: true, // Asegurar que devuelva el registro creado
            },
          );
        } catch (createError) {
          // Si falla por trigger, intentar buscar de nuevo
          if (createError.name === "SequelizeUniqueConstraintError") {
            autorizacion = await this.autorizacionModel.findOne({
              where: {
                municipioId: municipio.id,
                modalidadId: modalidad.id,
                tipoId: tipoAutorizacion.id,
                consecutivo1: datosArchivo.consecutivo1,
                consecutivo2: datosArchivo.consecutivo2,
              },
              transaction,
            });

            if (!autorizacion) {
              throw createError;
            }
          } else {
            throw createError;
          }
        }
      }

      await transaction.commit();
      return { autorizacion, municipio, modalidad, tipoAutorizacion };
    } catch (error) {
      await transaction.rollback();
      console.error("Error en buscarOCrearAutorizacion:", error);
      throw error;
    }
  }
  // Generar nombre de carpeta según función PostgreSQL
  generarNombreCarpeta(
    numeroAutorizacion,
    municipioNum,
    modalidadNum,
    consecutivo1,
    consecutivo2,
    tipoAbrev,
  ) {
    return [
      numeroAutorizacion,
      municipioNum.toString().padStart(2, "0"),
      modalidadNum.toString().padStart(2, "0"),
      consecutivo1.toString().padStart(4, "0"),
      consecutivo2.toString().padStart(4, "0"),
      tipoAbrev,
    ].join("_");
  }

  // Procesar archivo individual
  async procesarArchivoMasivo(
    archivoData,
    autorizacionInfo,
    userId,
    opciones = {},
  ) {
    const { useOcr = false } = opciones;
    console.log(`\n  [LOG-SERVICIO] -> Procesando archivo: ${archivoData.nombreOriginal || archivoData.nombre}`);
    const transaction = await this.documentoModel.sequelize.transaction();

    try {
      const { autorizacion, municipio, tipoAutorizacion } = autorizacionInfo;
      console.log(`  [LOG-SERVICIO] -> Creando transacción DB local para ${archivoData.nombre}`);

      // Determinar si procesamos con OCR
      let bufferFinal = archivoData.buffer;
      let textoOCR = null;
      let estadoOCR = useOcr ? "pendiente" : "completado";

      if (useOcr) {
        estadoOCR = "procesando";
        // Procesar con OCR
        const resultadoOCR = await OCRProcessorService.procesarPDFConOCR(
          archivoData.buffer,
          archivoData.nombre,
        );

        if (resultadoOCR.success) {
          bufferFinal = resultadoOCR.pdfBuffer;
          textoOCR = resultadoOCR.text;
          estadoOCR = "completado";
        } else {
          estadoOCR = "fallido";
          // Puedes decidir si continuar sin OCR o fallar
          console.warn(
            `OCR falló para ${archivoData.nombre}: ${resultadoOCR.error}`,
          );
        }
      }

      // Buscar si ya existe documento para esta autorización
      const esSinNomenclatura = archivoData.esSinNomenclatura;
      const nombreOriginal = archivoData.nombreOriginal || archivoData.nombre;

      let whereClause = {
        autorizacionId: autorizacion.id,
        version_actual: true,
      };

      if (esSinNomenclatura && nombreOriginal) {
        whereClause.descripcion = {

          [Op.like]: `%${nombreOriginal}%`,
          [Op.like]: `%${nombreOriginal}%`
        };
      }

      const documentoExistente = await this.documentoModel.findOne({
        where: whereClause,
        transaction,
      });

      // Crear estructura de carpetas
      const estructura = await this.construirEstructuraCarpetasNumericos({
        municipio: { id: municipio.num },
        tipoAutorizacion: {
          id: tipoAutorizacion.id,
          abreviatura: tipoAutorizacion.abreviatura,
        },
        numero: autorizacion.numeroAutorizacion,
        consecutivo: autorizacion.consecutivo1,
        nombreCarpeta: autorizacion.nombreCarpeta,
      });

      // Crear carpetas
      await this.crearEstructuraCarpetas(estructura.rutaCompleta);

      // Generar nombre de archivo
      const version = documentoExistente ? documentoExistente.version + 1 : 1;
      const nombreArchivo = await this.generarNombreArchivoMasivo(
        autorizacion,
        archivoData.nombre,
        version,
      );

      const rutaArchivo = path.join(estructura.rutaCompleta, nombreArchivo);

      console.log(`  [LOG-SERVICIO] -> Escribiendo archivo FÍSICO (Size: ${bufferFinal.length} bytes) en: ${rutaArchivo}`);
      // Guardar archivo físicamente (con OCR aplicado si corresponde)
      await fs.writeFile(rutaArchivo, bufferFinal);
      console.log(`  [LOG-SERVICIO] -> Archivo físico guardado con éxito.`);

      // Después de escribir el archivo en disco
      const pdfIdFinal = nombreArchivo.replace(/\.pdf$/i, "");
      console.log(
        `[NOTIF_SINCRONO] Actualizando ruta en Python: ${pdfIdFinal} → ${rutaArchivo}`,
      );

      // Calcular checksums del archivo final
      const checksumMd5 = crypto
        .createHash("md5")
        .update(bufferFinal)
        .digest("hex");
      const checksumSha256 = crypto
        .createHash("sha256")
        .update(bufferFinal)
        .digest("hex");

      // Si existe documento anterior, marcarlo como no actual
      if (documentoExistente) {
        await documentoExistente.update(
          { version_actual: false },
          { transaction },
        );
      }

      // Crear nuevo documento
      console.log(`  [LOG-SERVICIO] -> Guardando DB \`Documento\` -> version: ${version}`);
      const nuevoDocumento = await this.documentoModel.create(
        {
          autorizacionId: autorizacion.id,
          titulo: `Documento de autorización ${autorizacion.numeroAutorizacion}`,
          descripcion: `Documento cargado masivamente: ${archivoData.nombreOriginal}`,
          version: version,
          version_actual: true,
          documento_padre_id: documentoExistente
            ? documentoExistente.documento_padre_id || documentoExistente.id
            : null,
          estadoDigitalizacion: "digitalizado",
          paginas: this.estimarPaginas(bufferFinal),
          creadoPor: userId,
        },
        { transaction },
      );

      // Crear registro de archivo digital
      console.log(`  [LOG-SERVICIO] -> Guardando DB \`ArchivoDigital\``);
      const archivoDigital = await this.archivoDigitalModel.create(
        {
          documento_id: nuevoDocumento.id,
          nombre_archivo: nombreArchivo,
          ruta_almacenamiento: path.join(
            estructura.rutaRelativa,
            nombreArchivo,
          ),
          mime_type: "application/pdf",
          tamano_bytes: bufferFinal.length,
          checksum_md5: checksumMd5,
          checksum_sha256: checksumSha256,
          estado_ocr: estadoOCR,
          texto_ocr: textoOCR, // NUEVO: guardar texto extraído
          fecha_digitalizacion: new Date(),
          digitalizado_por: userId,
          version_archivo: version,
          total_paginas: this.estimarPaginas(bufferFinal),
        },
        { transaction },
      );

      // // Si hay texto OCR, puedes también guardarlo en una tabla separada
      // if (textoOCR) {
      //     await this.guardarTextoOCR(nuevoDocumento.id, textoOCR, transaction);
      // }

      console.log(`  [LOG-SERVICIO] -> \`commit()\` DB completado. Archivo procesado.`);
      await transaction.commit();
      await OCRProcessorService.actualizarRutaFinal(
        pdfIdFinal,
        rutaArchivo,
      ).catch((err) => {
        console.error(`[ERROR_NOTIF_SINCRONO] Falló para ${pdfIdFinal}:`, err);
      });
      return {
        autorizacionId: autorizacion.id,
        numeroAutorizacion: autorizacion.numeroAutorizacion,
        documentoId: nuevoDocumento.id,
        version: version,
        archivo: nombreArchivo,
        ocrAplicado: useOcr,
        estadoOCR: estadoOCR,
        exito: true,
      };
    } catch (error) {
      console.error("[ERROR_PROCESAR_ARCHIVO_MASIVO]", {
        message: error.message,
        name: error.name,
        parent: error.parent?.message,
        sql: error.sql,
      });
      console.log(`  [LOG-SERVICIO] -> Ejecutando \`rollback()\` DB por error en ${archivoData.nombre}`);
      await transaction.rollback();
      throw error;
    }
  }
  /**
   * Guardar texto OCR en tabla separada (opcional)
   */
  async guardarTextoOCR(documentoId, texto, transaction) {
    // Puedes crear una tabla TextoOCR o usar la existente
    // Ejemplo: await TextoOCR.create({ documentoId, texto }, { transaction });
  }
  // Construir estructura de carpetas (igual que en DocumentoService)
  construirEstructuraCarpetasNumericos(autorizacion) {
    const municipioId = String(autorizacion.municipio.id).padStart(2, "0");
    const tipoAutorizacionId = String(
      autorizacion.tipoAutorizacion.id,
    ).padStart(2, "0");
    const carpetaAutorizacion = autorizacion.nombreCarpeta;

    const rutaRelativa = path.join(
      municipioId,
      tipoAutorizacionId,
      carpetaAutorizacion,
    );

    const basePath = process.env.FILE_STORAGE_PATH || "./storage";
    const rutaCompleta = path.join(basePath, rutaRelativa);

    return { rutaRelativa, rutaCompleta, carpetaAutorizacion };
  }

  async crearEstructuraCarpetas(ruta) {
    try {
      await fs.mkdir(ruta, { recursive: true });
    } catch (error) {
      throw new Error(`Error al crear carpetas: ${error.message}`);
    }
  }
  /**
   * Intenta parsear el nombre sin lanzar error (para detección segura de nomenclatura)
   * @param {string} nombre - Nombre del archivo o carpeta
   * @returns {{ success: boolean, ...datos? }}
   */
  parsearNombreArchivoSafe(nombre) {
    try {
      const sinExt = (nombre || "").replace(/\.pdf$/i, "").trim();
      const sinPaginas = sinExt.replace(/\s*\(\d+\s*(pag\.?)?\)$/i, "");

      const regex =
        /^(\d+)[_\s-]+(\d+)[_\s-]+(\d+)[_\s-]+(\d+)[_\s-]+(\d+)[_\s-]*([a-zA-Z]+)?/i;
      const match = sinPaginas.match(regex);

      if (!match) return { success: false };

      return {
        success: true,
        numeroAutorizacion: match[1],
        municipioNum: match[2].padStart(2, "0"),
        modalidadNum: match[3].padStart(2, "0"),
        consecutivo1: match[4].padStart(2, "0"),
        consecutivo2: match[5].padStart(3, "0"),
        tipoAbrev: match[6] ? match[6].toUpperCase() : null,
      };
    } catch {
      return { success: false };
    }
  }
  async generarNombreArchivoMasivo(autorizacion, nombreOriginal, version) {
    const extension = path.extname(nombreOriginal);

    // ────────────────────────────────────────────────
    // ¿Tiene nomenclatura válida real?
    // ────────────────────────────────────────────────
    const parseoCarpeta = this.parsearNombreArchivoSafe(
      autorizacion?.nombreCarpeta || "",
    );
    const esConNomenclatura = parseoCarpeta.success;

    let baseName;

    if (esConNomenclatura) {
      // ──── CASO CON NOMENCLATURA (prioridad alta) ────
      baseName = (autorizacion.nombreCarpeta || "")
        .replace(/[\s-]+/g, "_") // unificar separadores
        .replace(/_+/g, "_") // evitar __
        .replace(/^_+|_+$/g, "") // quitar extremos
        .trim();

      if (!baseName) {
        baseName = `auth_${autorizacion.id || "sin-id"}`;
      }

      const timestamp = Date.now();
      baseName = `${baseName}_v${version}_${timestamp}`;
    } else {
      // ──── CASO SIN NOMENCLATURA o fallback ────
      baseName = path
        .basename(nombreOriginal, ".pdf")
        .replace(/[^a-zA-Z0-9-_áéíóúÁÉÍÓÚñÑ\s]/g, "_")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");

      if (!baseName || baseName.length < 3) {
        baseName = `documento_${Date.now().toString().slice(-8)}`;
      }

      baseName = `${baseName}_v${version}`;
    }

    // ────────────────────────────────────────────────
    // Obtener carpeta destino
    // ────────────────────────────────────────────────
    const estructura = await this.construirEstructuraCarpetasNumericos({
      municipio: { id: autorizacion.municipio?.num || 85 },
      tipoAutorizacion: {
        id: autorizacion.tipoAutorizacion?.id || 1,
        abreviatura: autorizacion.tipoAutorizacion?.abreviatura || "P",
      },
      numero: autorizacion.numeroAutorizacion,
      consecutivo: autorizacion.consecutivo1,
      nombreCarpeta: autorizacion.nombreCarpeta,
    });

    const rutaCompleta = estructura.rutaCompleta;

    let nombreFinal = `${baseName}${extension}`;
    let rutaCandidata = path.join(rutaCompleta, nombreFinal);
    let contador = 1;

    // Anti-colisión real (muy importante en cargas masivas)
    while (await this.existeArchivo(rutaCandidata)) {
      if (esConNomenclatura) {
        // Para nomenclatura: sufijo numérico después del timestamp
        nombreFinal = `${baseName}_${contador}${extension}`;
      } else {
        // Para sin nomenclatura: más legible con paréntesis
        const sinVersion = baseName.replace(/_v\d+$/, "");
        nombreFinal = `${sinVersion} (${contador})_v${version}${extension}`;
      }
      rutaCandidata = path.join(rutaCompleta, nombreFinal);
      contador++;
    }

    // Logs útiles para depuración
    console.log(
      `[NOMBRE_ARCHIVO] ${esConNomenclatura ? "CON NOMENCLATURA" : "SIN NOMENCLATURA"} → ${nombreFinal} (ruta: ${rutaCandidata})`,
    );

    return nombreFinal;
  }

  // Asegúrate de tener este helper (si no lo tienes, agrégalo al final de la clase)
  async existeArchivo(ruta) {
    try {
      await fs.access(ruta);
      return true;
    } catch {
      return false;
    }
  }

  estimarPaginas(buffer) {
    // Evitar desbordamiento V8 "Cannot create a string longer than 0x1fffffe8 characters"
    if (buffer.length > 200 * 1024 * 1024) return 500; // Para más de 200MB retornamos 500 según requerimiento
    try {
      const texto = buffer.toString("latin1");
      const matches = texto.match(/\/Type\s*\/Page\b/g);
      return matches ? matches.length : 1;
    } catch {
      return 1;
    }
  }

  // Método principal para procesar carga masiva
  // async procesarCargaMasiva(archivos, userId, opciones = {}) {
  //     const { useOcr = false, loteSize = 5 } = opciones; // Reducir loteSize para OCR

  //     try {
  //         const resultados = {
  //             total: archivos.length,
  //             exitosos: 0,
  //             fallidos: 0,
  //             conOCR: useOcr,
  //             detalles: []
  //         };

  //         // Para OCR, procesar secuencialmente o en lotes pequeños
  //         if (useOcr) {
  //             // Procesar uno por uno para no saturar Python
  //             for (const archivo of archivos) {
  //                 try {
  //                     const datosArchivo = this.parsearNombreArchivo(archivo.nombre);
  //                     const autorizacionInfo = await this.buscarOCrearAutorizacion(datosArchivo, userId);

  //                     const resultado = await this.procesarArchivoMasivo(
  //                         { ...archivo, nombreOriginal: datosArchivo.nombreOriginal },
  //                         autorizacionInfo,
  //                         userId,
  //                         { useOcr: true } // Pasar opción de OCR
  //                     );

  //                     resultados.exitosos++;
  //                     resultados.detalles.push({
  //                         archivo: archivo.nombre,
  //                         exito: true,
  //                         ...resultado
  //                     });
  //                 } catch (error) {
  //                     resultados.fallidos++;
  //                     resultados.detalles.push({
  //                         archivo: archivo.nombre,
  //                         exito: false,
  //                         error: error.message
  //                     });
  //                 }
  //             }
  //         } else {
  //             // Procesamiento normal en lotes paralelos
  //             for (let i = 0; i < archivos.length; i += loteSize) {
  //                 const lote = archivos.slice(i, i + loteSize);
  //                 const promesas = lote.map(async (archivo) => {
  //                     try {
  //                         // Parsear nombre del archivo
  //                         const datosArchivo = this.parsearNombreArchivo(archivo.nombre);

  //                         // Buscar o crear autorización
  //                         const autorizacionInfo = await this.buscarOCrearAutorizacion(datosArchivo, userId);

  //                         // Procesar archivo
  //                         const resultado = await this.procesarArchivoMasivo({
  //                             ...archivo,
  //                             nombreOriginal: datosArchivo.nombreOriginal
  //                         }, autorizacionInfo, userId);

  //                         resultados.exitosos++;
  //                         resultados.detalles.push({
  //                             archivo: archivo.nombre,
  //                             exito: true,
  //                             ...resultado
  //                         });
  //                     } catch (error) {
  //                         resultados.fallidos++;
  //                         resultados.detalles.push({
  //                             archivo: archivo.nombre,
  //                             exito: false,
  //                             error: error.message
  //                         });
  //                     }
  //                 });
  //                 await Promise.all(promesas);
  //             }
  //         }

  //         return resultados;
  //     } catch (error) {
  //         throw new Error(`Error en carga masiva: ${error.message}`);
  //     }
  // }
  // se hixo esta versio  para rgistrear logf apesar de que es sin ocr

  async procesarCargaMasiva(archivos, userId, opciones = {}) {
    const {
      useOcr = false,
      loteSize = 5,
      loteId = null,
      origen = "DIRECTO",
    } = opciones; // Reducir loteSize para OCR

    try {
      const resultados = {
        total: archivos.length,
        exitosos: 0,
        fallidos: 0,
        conOCR: useOcr,
        detalles: [],
      };

      // Para OCR, procesar secuencialmente o en lotes pequeños
      if (useOcr) {
        // Procesar uno por uno para no saturar Python
        let ocrIndex = 0;
        for (const archivo of archivos) {
          try {
            const datosArchivo = await this.obtenerDatosArchivo(
              archivo.nombre,
              {
                allowSinNomenclatura: opciones.allowSinNomenclatura || false,
                municipioFallbackNum: opciones.municipioFallbackNum,
                modalidadFallbackNum: opciones.modalidadFallbackNum,
                tipoFallbackAbrev: opciones.tipoFallbackAbrev,
              },
              ocrIndex++,
            );
            const autorizacionInfo = await this.buscarOCrearAutorizacion(
              datosArchivo,
              userId,
            );

            const resultado = await this.procesarArchivoMasivo(
              {
                ...archivo,
                nombreOriginal: datosArchivo.nombreOriginal,
                esSinNomenclatura: datosArchivo.esSinNomenclatura,
              },
              autorizacionInfo,
              userId,
              { useOcr: true }, // Pasar opción de OCR
            );

            resultados.exitosos++;
            resultados.detalles.push({
              archivo: archivo.nombre,
              exito: true,
              ...resultado,
            });
          } catch (error) {
            resultados.fallidos++;
            resultados.detalles.push({
              archivo: archivo.nombre,
              exito: false,
              error: error.message,
            });
          }
        }
      } else {
        // Procesamiento normal en lotes paralelos
        for (let i = 0; i < archivos.length; i += loteSize) {
          const lote = archivos.slice(i, i + loteSize);
          const promesas = lote.map(async (archivo, localIndex) => {
            let proceso = null; // importante para poder actualizarlo en catch
            let resultado = null;
            try {
              // Parsear nombre del archivo
              const datosArchivo = await this.obtenerDatosArchivo(
                archivo.nombre,
                {
                  allowSinNomenclatura: opciones.allowSinNomenclatura || false,
                  municipioFallbackNum: opciones.municipioFallbackNum,
                  modalidadFallbackNum: opciones.modalidadFallbackNum,
                  tipoFallbackAbrev: opciones.tipoFallbackAbrev,
                },
                i + localIndex,
              );

              // Buscar o crear autorización
              const autorizacionInfo = await this.buscarOCrearAutorizacion(
                datosArchivo,
                userId,
              );

              await proceso.update({ autorizacion_id: autorizacionInfo.autorizacion.id });

              // ================================
              //  PROCESAR ARCHIVO
              // ================================
              const resultado = await this.procesarArchivoMasivo(
                {
                  ...archivo,
                  nombreOriginal: datosArchivo.nombreOriginal,
                  esSinNomenclatura: datosArchivo.esSinNomenclatura,
                },
                autorizacionInfo,
                userId,
              );

              // ================================
              //  ACTUALIZAR A COMPLETADO
              // ================================
              await proceso.update({
                estado: "completado",
                documento_id: resultado.documentoId,
                fecha_procesado: new Date(),
              });

              resultados.exitosos++;
              resultados.detalles.push({
                archivo: archivo.nombre,
                exito: true,
                ...resultado,
              });
            } catch (error) {
              if (proceso) {
                // Solo marcar fallado si NO se creó el documento
                if (!resultado?.documentoId) {
                  await proceso.update({
                    estado: "fallado",
                    error: error.message,
                  });
                } else {
                  // Si llegó a crear documento, marcar como completado aunque haya warning
                  await proceso.update({
                    estado: "completado",
                    documento_id: resultado.documentoId,
                    fecha_procesado: new Date(),
                    error: `Warning: ${error.message} (pero documento creado)`,
                  });
                }
              }

              resultados.fallidos++;
              resultados.detalles.push({
                archivo: archivo.nombre,
                exito: false,
                error: error.message,
              });
            }
          });

          await Promise.all(promesas);
        }
      }

      return resultados;
    } catch (error) {
      throw new Error(`Error en carga masiva: ${error.message}`);
    }
  }

  // Método para recibir archivos directamente (no comprimidos)
  async procesarArchivosDirectos(archivos, userId, opciones = {}) {
    const archivosProcesados = archivos.map((archivo) => ({
      nombre: archivo.originalname,
      buffer: archivo.buffer,
      tamano: archivo.size,
    }));

    return await this.procesarCargaMasiva(archivosProcesados, userId, opciones);
  }
  /**
   * Iniciar procesamiento OCR asíncrono para archivo comprimido o directorios de archivos
   */
  async iniciarProcesamientoOCRAsincrono(
    archivos,
    userId,
    loteId,
    opciones = {}
  ) {
    try {
      if (!archivos || archivos.length === 0) {
        throw new Error("No se encontraron archivos PDF");
      }

      // Crear registros de lote en la base de datos
      const procesos = [];
      let asuncIndex = 0;

      for (const archivo of archivos) {
        try {
          const datosArchivo = await this.obtenerDatosArchivo(
            archivo.nombre,
            {
              allowSinNomenclatura: opciones?.allowSinNomenclatura || false,
              municipioFallbackNum: opciones?.municipioFallbackNum,
              modalidadFallbackNum: opciones?.modalidadFallbackNum,
              tipoFallbackAbrev: opciones?.tipoFallbackAbrev,
            },
            asuncIndex++,
          );

          // Buscar o crear autorización (sin transacción larga)
          autorizacionInfo = await this.buscarOCrearAutorizacionRapido(
            datosArchivo,
            userId,
          );

          await proceso.update({
             autorizacion_id: autorizacionInfo.autorizacion.id,
             metadata: { ...proceso.metadata, datosArchivo }
          });
          procesos.push(proceso);

          // Enviar a Python para OCR (en segundo plano)
          this.enviarArchivoParaOCR(
            {
              ...archivo,
              esSinNomenclatura: datosArchivo.esSinNomenclatura,
              nombreOriginal: datosArchivo.nombreOriginal,
            },
            proceso,
            autorizacionInfo,
            userId,
          ).catch((error) => {
            console.error(`Error procesando ${archivo.nombre}:`, error);
          });
        } catch (error) {
          console.error(`Error preparando ** ${archivo.nombre}:`, error);
          // Crear registro fallado
          await this.ocrProcesoModel.create({
            loteId,
            nombreArchivo: archivo.nombre,
            autorizacionId: null,
            userId,
            estado: "fallado",
            error: error.message,
            metadata: { error: true },
          });
        }
      }

      console.log(`Lote ${loteId} iniciado con ${procesos.length} archivos`);
      return { loteId, total: archivos.length, procesos: procesos.length };
    } catch (error) {
      console.error("Error iniciando procesamiento asíncrono:", error);
      throw error;
    }
  }

  /**
   * Versión rápida de buscarOCrearAutorizacion para OCR asíncrono
   */
  async buscarOCrearAutorizacionRapido(datosArchivo, userId) {
    console.log(datosArchivo);
    console.log(datosArchivo);
    console.log("###");
    console.log("###");
    try {
      const municipio = await this.municipioModel.findOne({
        where: { num: datosArchivo.municipioNum },
        attributes: ["id", "num"],
      });
      if (!municipio) {
        throw new Error(`Municipio ${datosArchivo.municipioNum} no encontrado`);
      }

      const modalidad = await this.modalidadModel.findOne({
        where: { num: datosArchivo.modalidadNum },
        attributes: ["id", "num"],
      });
      if (!modalidad) {
        throw new Error(`Modalidad ${datosArchivo.modalidadNum} no encontrada`);
      }

      const tipoAutorizacion = await this.tiposAutorizacionModel.findOne({
        where: { abreviatura: datosArchivo.tipoAbrev },
        attributes: ["id", "abreviatura"],
      });
      if (!tipoAutorizacion) {
        throw new Error(
          `Tipo autorización ${datosArchivo.tipoAbrev} no encontrado`,
        );
      }

      let autorizacion = await this.autorizacionModel.findOne({
        where: {
          municipioId: municipio.id,
          modalidadId: modalidad.id,
          tipoId: tipoAutorizacion.id,
          consecutivo1: datosArchivo.consecutivo1,
          consecutivo2: datosArchivo.consecutivo2,
        },
        attributes: ["id", "numeroAutorizacion", "nombreCarpeta"],
      });

      if (!autorizacion) {
        autorizacion = await this.autorizacionModel.create({
          numeroAutorizacion: datosArchivo.numeroAutorizacion, //
          municipioId: municipio.id,
          modalidadId: modalidad.id,
          tipoId: tipoAutorizacion.id,
          consecutivo1: datosArchivo.consecutivo1,
          consecutivo2: datosArchivo.consecutivo2,
          activo: true,
          fechaCreacion: new Date().toISOString().slice(0, 10),
          fechaSolicitud: new Date().toISOString().slice(0, 10),
        });
      }

      return {
        autorizacion,
        municipio,
        modalidad,
        tipoAutorizacion,
      };
    } catch (error) {
      console.error("Error en buscarOCrearAutorizacionRapido:", error);
      throw error;
    }
  }

  /**
   * Enviar archivo a Python para procesamiento OCR
   */
  async enviarArchivoParaOCR(archivoData, proceso, autorizacionInfo, userId) {
    try {
      // Actualizar estado a procesando
      await proceso.update({
        estado: "procesando",
        intentos: proceso.intentos + 1,
      });

      // Enviar a Python
      const envio = await OCRProcessorService.enviarPDFParaOCR(
        archivoData.buffer,
        archivoData.nombre,
      );

      if (!envio.success) {
        throw new Error(`Error enviando a Python: ${envio.error}`);
      }

      // Actualizar con ID de Python
      await proceso.update({
        archivoId: envio.pythonPdfId,
        metadata: {
          ...proceso.metadata,
          taskId: envio.taskId,
          pythonPdfId: envio.pythonPdfId,
        },
      });

      // Iniciar polling para verificar resultado
      this.monitorearProcesoOCR(proceso, autorizacionInfo, userId, archivoData);

      return { success: true, taskId: envio.taskId };
    } catch (error) {
      await proceso.update({
        estado:
          proceso.intentos >= proceso.maxIntentos ? "fallado" : "pendiente",
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Monitorear proceso OCR en Python
   */
  async monitorearProcesoOCR(proceso, autorizacionInfo, userId, archivoData) {
    const maxIntentosPolling = 360; // 360 intentos * 5 segundos = 30 minutos
    let intentos = 0;

    const intervalo = setInterval(async () => {
      try {
        intentos++;

        // **CORRECCIÓN 1: Verificar estado SIN loops internos**
        const estado = await OCRProcessorService.verificarEstadoOCRUnico(
          proceso.metadata.pythonPdfId,
          10000, // Timeout de 10 segundos
        );

        // Si Python responde con 'not found' o 404, seguir esperando
        if (
          estado.error?.includes("404") ||
          estado.error?.includes("not found")
        ) {
          console.log(
            `Esperando ${proceso.nombreArchivo}... (intento ${intentos})`,
          );

          if (intentos >= maxIntentosPolling) {
            clearInterval(intervalo);
            await proceso.update({
              estado:
                proceso.intentos >= proceso.maxIntentos
                  ? "fallado"
                  : "pendiente",
              error: "Timeout en procesamiento OCR",
            });
          }
          return;
        }

        if (estado.status === "completed") {
          clearInterval(intervalo);

          // **CORRECCIÓN 2: Llamar sin transacción para descargas**
          await this.finalizarProcesoOCRExitoso(
            proceso,
            estado,
            autorizacionInfo,
            userId,
            archivoData,
          );
        } else if (["failed", "error"].includes(estado.status) || intentos >= maxIntentosPolling) {
          clearInterval(intervalo);

          if (["failed", "error"].includes(estado.status)) {
            await proceso.update({
              estado: "fallado",
              error: estado.error || `Error en Python: ${estado.status}`,
            });
          } else if (intentos >= maxIntentosPolling) {
            // Timeout
            await proceso.update({
              estado:
                proceso.intentos >= proceso.maxIntentos
                  ? "fallado"
                  : "pendiente",
              error: estado.error || "Timeout en procesamiento OCR",
            });

            // Reintentar si aún tiene intentos
            if (proceso.intentos < proceso.maxIntentos) {
              setTimeout(() => {
                this.enviarArchivoParaOCR(
                  archivoData,
                  proceso,
                  autorizacionInfo,
                  userId,
                ).catch(console.error);
              }, 30000);
            }
          }
        }
      } catch (error) {
        console.error(`Error monitoreando ${proceso.nombreArchivo}:`, error);

        if (intentos >= maxIntentosPolling) {
          clearInterval(intervalo);
          await proceso.update({
            estado: "fallado",
            error: error.message,
          });
        }
      }
    }, 5000);
  }

  /**
   * Finalizar proceso OCR exitoso
   * @param {Object} proceso - Registro del proceso OCR en BD
   * @param {Object} estado - Respuesta del estado desde Python
   * @param {Object} autorizacionInfo - Info de autorización, municipio, etc.
   * @param {number} userId - ID del usuario
   * @param {Object} archivoData - Datos del archivo original
   */
  async finalizarProcesoOCRExitoso(
    proceso,
    estado,
    autorizacionInfo,
    userId,
    archivoData,
  ) {
    try {
      console.log(
        "[OCR_FINALIZAR] Estado recibido desde Python:",
        JSON.stringify(estado, null, 2),
      );

      const pythonPdfId = estado?.pythonPdfId;
      if (!pythonPdfId) {
        throw new Error("No se recibió pythonPdfId en el estado");
      }

      // Descargar resultados ANTES de abrir transacción
      const [pdfResult, textResult] = await Promise.all([
        OCRProcessorService.descargarPDFConOCR(pythonPdfId),
        OCRProcessorService.descargarTextoOCR(pythonPdfId),
      ]);

      // Manejo de errores de descarga
      if (pdfResult.error || textResult.error) {
        const errMsg =
          pdfResult.error ||
          textResult.error ||
          "Error desconocido al descargar";
        console.warn(
          `[OCR_DOWNLOAD_ERROR] ${errMsg} para ${proceso.nombre_archivo || proceso.nombreArchivo}`,
        );

        if (
          errMsg.includes("404") ||
          errMsg.includes("not found") ||
          errMsg.includes("202") ||
          errMsg.includes("pending")
        ) {
          console.log(
            `[REINTENTAR] Recursos aún no listos → ${proceso.nombre_archivo || "[sin nombre]"}`,
          );
          return { success: false, retry: true };
        }

        throw new Error(`Fallo al descargar resultados: ${errMsg}`);
      }

      // Verificar si OCR sigue pendiente
      if (
        textResult?.text &&
        typeof textResult.text === "object" &&
        textResult.text.status === "pending"
      ) {
        console.log(
          `[OCR_AUN_PENDIENTE] Progreso: ${textResult.text.progress || 0}% → ${proceso.nombre_archivo || "[sin nombre]"}`,
        );
        return { success: false, retry: true };
      }

      const transaction = await this.documentoModel.sequelize.transaction();

      try {
        // [NUEVO] Lógica de actualización en el mismo lugar (updateInPlace) para evitar crear versiones _v2
        const isUpdateInPlace = proceso.metadata?.updateInPlace;
        if (isUpdateInPlace && proceso.metadata?.archivoDigitalId) {
          const archivoExistente = await this.archivoDigitalModel.findByPk(proceso.metadata.archivoDigitalId, { transaction });
          const documentoExistente = await this.documentoModel.findByPk(proceso.metadata.documentoId, { transaction });

          if (archivoExistente && documentoExistente) {
            const basePath = process.env.FILE_STORAGE_PATH || "./storage";
            const rutaAbsoluta = path.join(basePath, archivoExistente.ruta_almacenamiento);
            
            console.log(`  [OCR_FINALIZAR] Sobreescribiendo archivo existente (updateInPlace): ${rutaAbsoluta}`);
            await fs.writeFile(rutaAbsoluta, pdfResult.pdfBuffer);

            const checksumMd5 = crypto.createHash("md5").update(pdfResult.pdfBuffer).digest("hex");
            const checksumSha256 = crypto.createHash("sha256").update(pdfResult.pdfBuffer).digest("hex");

            await archivoExistente.update({
              tamano_bytes: pdfResult.pdfBuffer.length,
              checksum_md5: checksumMd5,
              checksum_sha256: checksumSha256,
              estado_ocr: "completado",
              texto_ocr: textResult.text,
              total_paginas: this.estimarPaginas(pdfResult.pdfBuffer),
            }, { transaction });

            await proceso.update({
              estado: "completado",
              documento_id: documentoExistente.id,
              fecha_procesado: new Date(),
              metadata: {
                ...proceso.metadata,
                rutaArchivo: rutaAbsoluta,
                pdfIdFinal: archivoExistente.nombre_archivo.replace(/\.pdf$/i, "")
              }
            }, { transaction });

            await OCRProcessorService.actualizarRutaFinal(
              pythonPdfId,
              rutaAbsoluta
            ).catch(err => console.warn(`[WARN_COMPAT] ${pythonPdfId}:`, err));

            await transaction.commit();
            return { success: true, documentoId: documentoExistente.id };
          }
        }

        const esSinNomenclatura =
          archivoData.esSinNomenclatura ||
          proceso.metadata?.datosArchivo?.esSinNomenclatura;
        const nombreOriginal =
          archivoData.nombreOriginal ||
          proceso.metadata?.datosArchivo?.nombreOriginal ||
          archivoData.nombre;

        let whereClause = {
          autorizacionId: autorizacionInfo.autorizacion.id,
          version_actual: true,
        };

        if (esSinNomenclatura && nombreOriginal) {
          whereClause.descripcion = {
            [Op.like]: `%${nombreOriginal}%`,
          };
        }

        const documentoExistente = await this.documentoModel.findOne({
          where: whereClause,
          transaction,
        });

        const estructura = await this.construirEstructuraCarpetasNumericos({
          municipio: { id: autorizacionInfo.municipio.num },
          tipoAutorizacion: {
            id: autorizacionInfo.tipoAutorizacion.id,
            abreviatura: autorizacionInfo.tipoAutorizacion.abreviatura,
          },
          numero: autorizacionInfo.autorizacion.numeroAutorizacion,
          consecutivo: autorizacionInfo.autorizacion.consecutivo1,
          nombreCarpeta: autorizacionInfo.autorizacion.nombreCarpeta,
        });

        await this.crearEstructuraCarpetas(estructura.rutaCompleta);

        const version = documentoExistente ? documentoExistente.version + 1 : 1;
        const nombreArchivo = await this.generarNombreArchivoMasivo(
          autorizacionInfo.autorizacion,
          archivoData.nombre,
          version,
        );

        const rutaArchivo = path.join(estructura.rutaCompleta, nombreArchivo);

        await fs.writeFile(rutaArchivo, pdfResult.pdfBuffer);

        // ────────────────────────────────────────────────
        // ¡ESTO ES LO QUE FALTABA! Notificar el nombre FINAL
        // ────────────────────────────────────────────────
        const pdfIdFinal = nombreArchivo.replace(/\.pdf$/i, "");

        console.log(
          `[NOTIFICAR_PYTHON_FINAL] pdf_id versionado: ${pdfIdFinal} → ${rutaArchivo}`,
        );

        await OCRProcessorService.actualizarRutaFinal(
          pythonPdfId,
          rutaArchivo,
        ).catch((err) => {
          console.warn(`[WARN_COMPAT] ${pythonPdfId}:`, err);
        });

        const checksumMd5 = crypto
          .createHash("md5")
          .update(pdfResult.pdfBuffer)
          .digest("hex");
        const checksumSha256 = crypto
          .createHash("sha256")
          .update(pdfResult.pdfBuffer)
          .digest("hex");

        if (documentoExistente) {
          await documentoExistente.update(
            { version_actual: false },
            { transaction },
          );
        }

        const nuevoDocumento = await this.documentoModel.create(
          {
            autorizacionId: autorizacionInfo.autorizacion.id,
            titulo: `Documento con OCR ${autorizacionInfo.autorizacion.numeroAutorizacion}`,
            descripcion: `Documento procesado con OCR: ${archivoData.nombre}`,
            version: version,
            version_actual: true,
            documento_padre_id: documentoExistente
              ? documentoExistente.documento_padre_id || documentoExistente.id
              : null,
            estadoDigitalizacion: "digitalizado",
            paginas: this.estimarPaginas(pdfResult.pdfBuffer),
            creadoPor: userId,
          },
          { transaction },
        );

        await this.archivoDigitalModel.create(
          {
            documento_id: nuevoDocumento.id,
            nombre_archivo: nombreArchivo,
            ruta_almacenamiento: path.join(
              estructura.rutaRelativa,
              nombreArchivo,
            ),
            mime_type: "application/pdf",
            tamano_bytes: pdfResult.pdfBuffer.length,
            checksum_md5: checksumMd5,
            checksum_sha256: checksumSha256,
            estado_ocr: "completado",
            texto_ocr: textResult.text,
            fecha_digitalizacion: new Date(),
            digitalizado_por: userId,
            version_archivo: version,
            total_paginas: this.estimarPaginas(pdfResult.pdfBuffer),
          },
          { transaction },
        );

        await proceso.update(
          {
            estado: "completado",
            documento_id: nuevoDocumento.id,
            fecha_procesado: new Date(),
            metadata: {
              ...proceso.metadata,
              documentoId: nuevoDocumento.id,
              rutaArchivo,
              pdfIdFinal, // ← guardamos para referencia futura
            },
          },
          { transaction },
        );

        await transaction.commit();

        const nombreLog =
          proceso.nombre_archivo ||
          proceso.nombreArchivo ||
          proceso.archivo_id ||
          "[sin-nombre]";
        console.log(
          `[OCR_COMPLETADO] Éxito → ${nombreLog} → Doc ID: ${nuevoDocumento.id} → Archivo: ${nombreArchivo}`,
        );

        return { success: true, documentoId: nuevoDocumento.id };
      } catch (error) {
        await transaction.rollback();
        console.error(`[OCR_TRANS_ROLLBACK] Error en transacción:`, error);
        throw error;
      }
    } catch (error) {
      console.error(
        `[OCR_FINALIZAR_ERROR] Fallo general en ${proceso.nombre_archivo || "[sin nombre]"}:`,
        error,
      );

      await proceso
        .update({
          estado:
            proceso.intentos >= (proceso.maxIntentos || 3)
              ? "fallado"
              : "pendiente",
          error: error.message,
          intentos: (proceso.intentos || 0) + 1,
        })
        .catch((e) =>
          console.error("[UPDATE_FAIL] No se pudo actualizar proceso:", e),
        );

      throw error;
    }
  }

  /**
   * Obtener estado de un lote OCR
   */
  async obtenerEstadoLoteOCR(loteId, userId) {
    const procesos = await this.ocrProcesoModel.findAll({
      where: { loteId, userId },
      attributes: ["estado", "createdAt"],
    });

    const conteo = procesos.reduce((acc, proceso) => {
      acc[proceso.estado] = (acc[proceso.estado] || 0) + 1;
      return acc;
    }, {});

    return {
      total: procesos.length,
      conteo,
      completado: conteo.completado || 0,
      pendiente: conteo.pendiente || 0,
      procesando: conteo.procesando || 0,
      fallado: conteo.fallado || 0,
      porcentaje:
        procesos.length > 0
          ? Math.round(((conteo.completado || 0) / procesos.length) * 100)
          : 0,
    };
  }

  /**
   * Obtener resultados detallados de un lote OCR
   */
  async obtenerResultadosLoteOCR(loteId, userId) {
    const procesos = await this.ocrProcesoModel.findAll({
      where: { loteId, userId },
      include: [
        {
          model: this.documentoModel,
          as: "documento",
          attributes: ["id", "version", "titulo"],
        },
        {
          model: this.autorizacionModel,
          as: "autorizacion",
          attributes: ["id", "numeroAutorizacion"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const resultados = procesos.map((proceso) => ({
      nombreArchivo: proceso.nombreArchivo,
      estado: proceso.estado,
      error: proceso.error,
      documentoId: proceso.documentoId,
      autorizacionId: proceso.autorizacionId,
      numeroAutorizacion: proceso.autorizacion
        ? proceso.autorizacion.numeroAutorizacion
        : null,
      intentos: proceso.intentos,
      fechaCreacion: proceso.createdAt,
      fechaProcesado: proceso.fechaProcesado,
    }));

    const conteo = procesos.reduce((acc, proceso) => {
      acc[proceso.estado] = (acc[proceso.estado] || 0) + 1;
      return acc;
    }, {});

    return {
      total: procesos.length,
      conteo,
      resultados,
      todosCompletados: (conteo.completado || 0) === procesos.length,
      tieneErrores: (conteo.fallado || 0) > 0,
    };
  }

  /**
   * Listar lotes por usuario
   */
  async listarLotesPorUsuario(userId, limit = 20, offset = 0) {
    const { fn, col, literal } = this.ocrProcesoModel.sequelize;

    // Verificar si hay procesos pendientes ANTES de llamar a Python
    const hayPendientes = await this.ocrProcesoModel.count({
      where: {
        user_id: userId,
        estado: { [Op.in]: ["pendiente", "procesando"] },
      },
    });

    let pdfs = [];
    if (hayPendientes > 0) {
      // Solo hacemos UNA llamada a Python en lugar de dos
      const pythonResponse = await OCRProcessorService.listarProcesos();
      pdfs = pythonResponse.pdfs || [];
      await this.reconciliarProcesosOCRPendientes(userId, pdfs);
    }
    
    // Obtener total de lotes distintos para la paginación
    const totalLotes = await this.ocrProcesoModel.count({
      where: { user_id: userId },
      distinct: true,
      col: 'lote_id'
    });

    const lotes = await this.ocrProcesoModel.findAll({
      where: { user_id: userId },
      attributes: [
        ["lote_id", "loteId"],
        ["tipo_proceso", "tipoProceso"],
        ["origen", "origen"],

        [fn("COUNT", col("id")), "totalArchivos"],

        [
          fn(
            "SUM",
            literal(`CASE WHEN estado = 'completado' THEN 1 ELSE 0 END`),
          ),
          "completados",
        ],

        [
          fn("SUM", literal(`CASE WHEN estado = 'fallado' THEN 1 ELSE 0 END`)),
          "fallados",
        ],

        [
          fn(
            "ARRAY_AGG",
            literal(`CASE WHEN estado = 'fallado' THEN error ELSE NULL END`),
          ),
          "errores",
        ],

        [
          fn(
            "JSON_AGG",
            literal(`
                        CASE 
                            WHEN estado = 'completado' THEN
                                json_build_object(
                                    'nombreArchivo', nombre_archivo,
                                    'documentoId', documento_id,
                                    'metadata', metadata,
                                    'fechaProcesado', fecha_procesado
                                )
                            ELSE NULL
                        END
                    `),
          ),
          "archivosProcesados",
        ],

        [fn("MAX", col("created_at")), "ultimoProceso"],
      ],

      group: ["lote_id", "tipo_proceso", "origen"], //  IMPORTANTE
      order: [[literal('"ultimoProceso"'), "DESC"]],
      limit,
      offset,
      raw: true,
    });
    const lotesRes = lotes.map((lote) => {
      // Usar los PDFs del lote que Python conoce
      const procesosDelLote = pdfs.filter(
        (p) =>
          p.task_id &&
          lote.archivosProcesados
            ?.map((a) => a?.metadata?.taskId)
            .includes(p.task_id),
      );

      // PDFs actualmente procesándose
      // Solo para este lote
      const procesosEnCurso = pdfs.filter(
        (p) =>
          p.task_id &&
          p.status === "processing" &&
          lote.archivosProcesados
            ?.map((a) => a?.metadata?.taskId)
            .includes(p.task_id),
      );

      const todosProcesos = [...procesosDelLote, ...procesosEnCurso];

      const numCompleted = Number(lote.completados) || 0;
      const sumProgressEnCurso = procesosEnCurso.reduce(
        (acc, p) => acc + (p.progress || 0),
        0,
      );
      const totalConocidosParaProgreso = numCompleted + procesosEnCurso.length;

      const progresoPromedio =
        totalConocidosParaProgreso > 0
          ? Math.round(
              (numCompleted * 100 + sumProgressEnCurso) /
                (numCompleted + todosProcesos.length),
            )
          : 0;

      const paginasTotales = todosProcesos.reduce(
        (acc, p) => acc + (p.pages || 0),
        0,
      );

      const porcentajeFinal =
        lote.totalArchivos > 0
          ? Math.round((lote.completados / lote.totalArchivos) * 100)
          : progresoPromedio;

      return {
        loteId: lote.loteId,
        tipoProceso: lote.tipoProceso,
        origen: lote.origen,

        totalArchivos: Number(lote.totalArchivos),
        completados: Number(lote.completados),
        fallados: Number(lote.fallados),

        porcentaje: porcentajeFinal,

        progresoOCR: progresoPromedio,
        paginasTotales,

        errores: (lote.errores || []).filter(Boolean),
        archivosProcesados: (lote.archivosProcesados || []).filter(Boolean),
        ultimoProceso: lote.ultimoProceso,
      };
    });

    return {
      lotes: lotesRes,
      total: totalLotes,
      totalPages: Math.ceil(totalLotes / limit)
    };
    // return lotes.map(lote => ({
    //     loteId: lote.loteId,
    //     tipoProceso: lote.tipoProceso,
    //     origen: lote.origen,

    //     totalArchivos: Number(lote.totalArchivos),
    //     completados: Number(lote.completados),
    //     fallados: Number(lote.fallados),

    //     porcentaje: lote.totalArchivos > 0
    //         ? Math.round((lote.completados / lote.totalArchivos) * 100)
    //         : 0,

    //     errores: (lote.errores || []).filter(Boolean),
    //     archivosProcesados: (lote.archivosProcesados || []).filter(Boolean),
    //     ultimoProceso: lote.ultimoProceso
    // }));
  }

  // async listarLotesPorUsuario(userId, limit = 20, offset = 0) {
  //     const { fn, col, literal } = this.ocrProcesoModel.sequelize;

  //     await this.reconciliarProcesosOCRPendientes(userId);

  //     const lotes = await this.ocrProcesoModel.findAll({
  //         where: { user_id: userId },
  //         attributes: [
  //             ['lote_id', 'loteId'],
  //             [fn('COUNT', col('id')), 'totalArchivos'],
  //             [fn('SUM', literal(`CASE WHEN estado = 'completado' THEN 1 ELSE 0 END`)), 'completados'],
  //             [fn('SUM', literal(`CASE WHEN estado = 'fallado' THEN 1 ELSE 0 END`)), 'fallados'],
  //             [
  //                 fn(
  //                     'ARRAY_AGG',
  //                     literal(`CASE WHEN estado = 'fallado' THEN error ELSE NULL END`)
  //                 ),
  //                 'errores'
  //             ],
  //             [
  //                 fn(
  //                     'JSON_AGG',
  //                     literal(`
  //                 CASE
  //                     WHEN estado = 'completado' THEN
  //                     json_build_object(
  //                         'nombreArchivo', nombre_archivo,
  //                         'documentoId', documento_id,
  //                         'metadata', metadata,
  //                         'fechaProcesado', fecha_procesado
  //                     )
  //                     ELSE NULL
  //                 END
  //                 `)
  //                 ),
  //                 'archivosProcesados'
  //             ],
  //             [fn('MAX', col('created_at')), 'ultimoProceso']
  //         ],
  //         group: ['lote_id'],
  //         order: [[literal('"ultimoProceso"'), 'DESC']],
  //         raw: true
  //     });

  //     return lotes.map(lote => ({
  //         loteId: lote.loteId,
  //         totalArchivos: Number(lote.totalArchivos),
  //         completados: Number(lote.completados),
  //         fallados: Number(lote.fallados),
  //         porcentaje: lote.totalArchivos > 0
  //             ? Math.round((lote.completados / lote.totalArchivos) * 100)
  //             : 0,
  //         errores: (lote.errores || []).filter(Boolean),
  //         archivosProcesados: (lote.archivosProcesados || []).filter(Boolean),
  //         ultimoProceso: lote.ultimoProceso
  //     }));

  // }

  /**
   * Iniciar procesamiento directo OCR asíncrono
   */
  async iniciarProcesamientoDirectoOCRAsincrono(archivos, userId, loteId, opciones = {}) {
    try {
      const procesos = [];
      let directoIndex = 0;

      for (const archivo of archivos) {
        let autorizacionInfo = null;

        try {
          const datosArchivo = await this.obtenerDatosArchivo(
            archivo.originalname,
            {
              allowSinNomenclatura: opciones?.allowSinNomenclatura || true,
              municipioFallbackNum: opciones?.municipioFallbackNum || 85,
              modalidadFallbackNum: opciones?.modalidadFallbackNum || 52,
              tipoFallbackAbrev: opciones?.tipoFallbackAbrev || "P",
            },
            directoIndex++,
          );
          autorizacionInfo = await this.buscarOCrearAutorizacionRapido(
            datosArchivo,
            userId,
          );

          const proceso = await this.ocrProcesoModel.create({
            lote_id: loteId,
            archivo_id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nombre_archivo: archivo.originalname,
            autorizacion_id: autorizacionInfo.autorizacion.id,
            user_id: userId,
            estado: "pendiente",
            metadata: {
              datosArchivo,
              tamano: archivo.size,
            },
          });

          procesos.push(proceso);

          this.enviarArchivoParaOCR(
            {
              buffer: archivo.buffer,
              nombre: archivo.originalname,
              tamano: archivo.size,
              esSinNomenclatura: datosArchivo.esSinNomenclatura,
              nombreOriginal: datosArchivo.nombreOriginal,
            },
            proceso,
            autorizacionInfo,
            userId,
          ).catch((err) =>
            console.error(`Error procesando ${archivo.originalname}:`, err),
          );
        } catch (error) {
          console.error(`Error preparando ### ${archivo.originalname}:`, error);

          await this.ocrProcesoModel.create({
            lote_id: loteId,
            archivo_id: `error_${Date.now()}`,
            nombre_archivo: archivo.originalname,
            autorizacion_id: autorizacionInfo?.autorizacion?.id ?? 0,
            user_id: userId,
            estado: "fallado",
            error: error.message,
            metadata: { error: true },
          });
        }
      }

      console.log(
        `Lote directo ${loteId} iniciado con ${procesos.length} archivos`,
      );
      return { loteId, total: archivos.length, procesos: procesos.length };
    } catch (error) {
      console.error("Error iniciando procesamiento directo asíncrono:", error);
      throw error;
    }
  }

  /**
   * Reprogramar verificación para más tarde
   */
  reprogramarVerificacion(proceso, autorizacionInfo, userId, archivoData) {
    setTimeout(async () => {
      try {
        // Verificar estado nuevamente
        const estado = await OCRProcessorService.verificarEstadoOCRUnico(
          proceso.metadata.pythonPdfId,
        );

        if (estado.success && estado.status === "completed") {
          await this.finalizarProcesoOCRExitoso(
            proceso,
            estado,
            autorizacionInfo,
            userId,
            archivoData,
          );
        }
      } catch (error) {
        console.error(`Error en verificación reprogramada: ${error.message}`);
      }
    }, 10000); // Esperar 10 segundos
  }

  async reconciliarProcesosOCRPendientes(userId, providedPdfs = null) {
    const pendientes = await this.ocrProcesoModel.findAll({
      where: {
        user_id: userId,
        estado: { [Op.in]: ["pendiente", "procesando"] },
      },
    });

    if (!pendientes.length) return;

    let pdfs = providedPdfs;
    if (!pdfs) {
      const response = await OCRProcessorService.listarProcesos();
      pdfs = response.pdfs || [];
    }

    for (const proceso of pendientes) {
      const taskId = proceso.metadata?.taskId;
      if (!taskId) continue;

      const task = pdfs.find((p) => p.task_id === taskId);
      if (!task || task.status !== "completed") continue;

      console.log("proceso");
      console.log(proceso);
      await this.finalizarProcesoOCRExitoso(
        proceso,
        {
          success: true,
          status: "completed",
          pythonPdfId: task.id,
        },
        await this.obtenerAutorizacionInfoDesdeProceso(proceso),
        proceso.user_id,
        { nombre: proceso.nombre_archivo },
      );
    }
  }
  /**
   * Reconstruir autorizacionInfo desde un proceso OCR
   * (sin depender del flujo original en memoria)
   */
  async obtenerAutorizacionInfoDesdeProceso(proceso) {
    if (!proceso.autorizacion_id) {
      throw new Error("El proceso OCR no tiene autorizacion_id");
    }

    // Autorización base
    const autorizacion = await this.autorizacionModel.findByPk(
      proceso.autorizacion_id,
      {
        attributes: [
          "id",
          "numeroAutorizacion",
          "nombreCarpeta",
          "consecutivo1",
          "municipioId",
          "tipoId",
        ],
      },
    );

    if (!autorizacion) {
      throw new Error(`Autorización ${proceso.autorizacion_id} no encontrada`);
    }

    // Municipio
    const municipio = await this.municipioModel.findByPk(
      autorizacion.municipioId,
      {
        attributes: ["id", "num"],
      },
    );

    if (!municipio) {
      throw new Error("Municipio no encontrado para la autorización");
    }

    // Tipo de autorización
    const tipoAutorizacion = await this.tiposAutorizacionModel.findByPk(
      autorizacion.tipoId,
      {
        attributes: ["id", "abreviatura"],
      },
    );

    if (!tipoAutorizacion) {
      throw new Error("Tipo de autorización no encontrado");
    }

    return {
      autorizacion,
      municipio,
      tipoAutorizacion,
    };
  }
  /**
  /**
   * Obtiene datos de autorización: intenta parsear el nombre,
   * si falla y allowSinNomenclatura=true → usa fallback
   */
  async obtenerDatosArchivo(nombreArchivo, opciones = {}, index = 0) {
    const {
      allowSinNomenclatura = false,
      municipioFallbackNum = 85,
      modalidadFallbackNum = 52,
      tipoFallbackAbrev = "P",
    } = opciones;

    try {
      // Intentamos parsear siempre (prioridad a datos reales)
      const parseado = this.parsearNombreArchivo(nombreArchivo);
      parseado.esSinNomenclatura = false;
      return parseado;
    } catch (err) {
      if (!allowSinNomenclatura) {
        // Modo estricto → propagamos el error
        throw err;
      }

      // Modo sin nomenclatura → fallback buscando el consecutivo más alto tipo P-1, P-2
      // Modo sin nomenclatura → fallback buscando el consecutivo más alto tipo P-1, P-2
      const municipioInfo = await this.municipioModel.findOne({
        where: { num: municipioFallbackNum },
      });
      const modalidadInfo = await this.modalidadModel.findOne({
        where: { num: modalidadFallbackNum },
      });
      const tipoInfo = await this.tiposAutorizacionModel.findOne({
        where: { abreviatura: tipoFallbackAbrev },
      });

      let nextNumber = 1;
      if (municipioInfo && modalidadInfo && tipoInfo) {
        // Buscar las autorizaciones de este tipo para obtener el máximo consecutivo1
        const maxAuth = await this.autorizacionModel.findOne({
          where: {
            municipioId: municipioInfo.id,
            modalidadId: modalidadInfo.id,
            tipoId: tipoInfo.id,
          },
          order: [["consecutivo1", "DESC"]],
        });

        if (maxAuth && maxAuth.consecutivo1) {
          nextNumber = parseInt(maxAuth.consecutivo1, 10) + 1;
        }
      } else {
        // Fallback porsi no encontramos los ids
        nextNumber = Math.floor(Math.random() * 10000);
      }

      nextNumber += index; // Evitar colisiones en procesamientos masivos por lotes
      const nextNumString = nextNumber.toString().padStart(2, "0");

      const seqLabel = nextNumber.toString();
      console.warn(
        `[SIN NOMENCLATURA] Nombre inválido (${nombreArchivo}) → usando fallback P-${seqLabel}`,
      );

      return {
        numeroAutorizacion: `P-${seqLabel}`,
        municipioNum: municipioFallbackNum,
        modalidadNum: modalidadFallbackNum,
        tipoAbrev: tipoFallbackAbrev,
        consecutivo1: nextNumString,
        consecutivo2: "000",
        nombreOriginal: nombreArchivo,
        esSinNomenclatura: true,
      };
    }
  }

  // ============== Procesamiento por Municipio ==============
  async obtenerMunicipioProcesando() {
    if (!global.activeOcrLock) {
      // Reconciliación: buscar si hay algún lote activo en BD
      const activeDbProcess = await this.ocrProcesoModel.findOne({
        where: { estado: ["pendiente", "procesando"] },
        order: [["createdAt", "DESC"]],
      });

      if (activeDbProcess) {
        console.log("[RECONCILIACION] Limpiando procesos OCR huérfanos tras reinicio del servidor...");
        try {
          await this.ocrProcesoModel.update(
            { estado: "fallado", error: "Interrumpido por reinicio del servidor" },
            { where: { estado: ["pendiente", "procesando"] } }
          );
          await this.archivoDigitalModel.update(
            { estado_ocr: "pendiente" },
            { where: { estado_ocr: "procesando" } }
          );
        } catch (err) {
          console.error("Error limpiando procesos huérfanos:", err);
        }
      }
    }
    return global.activeOcrLock || null;
  }

  async obtenerArchivosPendientesPorMunicipioCount(municipioNum) {
    const municipio = await this.municipioModel.findOne({ where: { num: municipioNum } });
    if (!municipio) return 0;

    return await this.archivoDigitalModel.count({
      where: {
        estado_ocr: { [Op.in]: ["pendiente", "fallido"] },
      },
      include: [
        {
          model: this.documentoModel,
          as: "documento",
          required: true,
          include: [
            {
              model: this.autorizacionModel,
              as: "autorizacion",
              where: { municipioId: municipio.id },
              required: true,
            },
          ],
        },
      ],
    });
  }

  async obtenerArchivosFallidosPorMunicipio(municipioNum) {
    const municipio = await this.municipioModel.findOne({ where: { num: municipioNum } });
    if (!municipio) return [];

    const archivos = await this.archivoDigitalModel.findAll({
      where: {
        estado_ocr: "fallido",
      },
      include: [
        {
          model: this.documentoModel,
          as: "documento",
          required: true,
          include: [
            {
              model: this.autorizacionModel,
              as: "autorizacion",
              where: { municipioId: municipio.id },
              required: true,
            },
          ],
        },
      ],
    });

    // Formatear la lista de fallidos con su error y fecha
    return archivos.map((a) => {
      const errorMsg = a.metadatos_tecnicos?.error || "Error de procesamiento OCR desconocido";
      const failedAt = a.metadatos_tecnicos?.failedAt || new Date();
      return {
        id: a.id,
        nombreArchivo: a.nombre_archivo,
        error: errorMsg,
        fecha: failedAt,
      };
    });
  }

  async procesarOcrMunicipio(municipioNum, userId, limite = null) {
    const municipio = await this.municipioModel.findOne({ where: { num: municipioNum } });
    if (!municipio) {
      throw new Error(`Municipio con número ${municipioNum} no encontrado.`);
    }

    const currentLock = await this.obtenerMunicipioProcesando();
    if (currentLock) {
      throw new Error(`Ya hay un municipio procesándose actualmente (${currentLock.municipioNombre || currentLock.municipioNum}).`);
    }

    const pendingCount = await this.archivoDigitalModel.count({
      where: {
        estado_ocr: { [Op.in]: ["pendiente", "fallido"] },
      },
      include: [
        {
          model: this.documentoModel,
          as: "documento",
          required: true,
          include: [
            {
              model: this.autorizacionModel,
              as: "autorizacion",
              where: { municipioId: municipio.id },
              required: true,
            },
          ],
        },
      ],
    });

    const totalToProcess = limite ? Math.min(parseInt(limite, 10), pendingCount) : pendingCount;

    if (totalToProcess === 0) {
      throw new Error("No hay archivos en cola ('pendiente' o 'fallido') para este municipio.");
    }

    const loteId = `lote_muni_${municipioNum}_${Date.now()}`;
    global.activeOcrLock = {
      municipioNum,
      municipioId: municipio.id,
      municipioNombre: municipio.nombre,
      loteId,
      total: totalToProcess,
      completados: 0,
      fallados: 0,
      errores: [],
      startedAt: new Date(),
    };

    // Iniciar procesamiento en segundo plano pasándole el municipio completo
    this.ejecutarProcesamientoOcrMunicipioBackground(municipio, loteId, userId, totalToProcess).catch((err) => {
      console.error("Error en procesamiento de municipio en background:", err);
    });

    return { total: totalToProcess, loteId };
  }

  async ejecutarProcesamientoOcrMunicipioBackground(municipio, loteId, userId, maxLimit) {
    const basePath = process.env.FILE_STORAGE_PATH || "./storage";
    const chunkSize = 2; // Procesar de 2 en 2 para cuidar la memoria y el servidor OCR

    try {
      let procesados = 0;

      while (procesados < maxLimit) {
        const remaining = maxLimit - procesados;
        const currentLimit = Math.min(chunkSize, remaining);

        // Traer de BD el siguiente chunk de archivos pendientes para el municipio
        const chunk = await this.archivoDigitalModel.findAll({
          where: { estado_ocr: { [Op.in]: ["pendiente", "fallido"] } },
          limit: currentLimit,
          order: [['id', 'ASC']],
          include: [
            {
              model: this.documentoModel,
              as: "documento",
              required: true,
              include: [
                {
                  model: this.autorizacionModel,
                  as: "autorizacion",
                  where: { municipioId: municipio.id },
                  required: true,
                  include: [
                    { model: this.municipioModel, as: "municipio" },
                    { model: this.modalidadModel, as: "modalidad" },
                    { model: this.tiposAutorizacionModel, as: "tipoAutorizacion" },
                  ],
                },
              ],
            },
          ],
        });

        if (chunk.length === 0) break; // Ya no hay más

        const chunkProcesos = [];

        for (const file of chunk) {
          try {
            const absolutePath = path.join(basePath, file.ruta_almacenamiento);
            const fileBuffer = await fs.readFile(absolutePath);

            const autorizacion = file.documento.autorizacion;
            const autorizacionInfo = {
              autorizacion,
              municipio: autorizacion.municipio,
              modalidad: autorizacion.modalidad,
              tipoAutorizacion: autorizacion.tipoAutorizacion,
            };

            const parsedName = this.parsearNombreArchivoSafe(file.nombre_archivo);

            const proceso = await this.ocrProcesoModel.create({
              lote_id: loteId,
              archivo_id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              nombre_archivo: file.nombre_archivo,
              autorizacion_id: autorizacion.id,
              user_id: userId,
              estado: "pendiente",
              metadata: {
                datosArchivo: {
                  ...parsedName,
                  esSinNomenclatura: !parsedName.success,
                  nombreOriginal: file.nombre_archivo,
                },
                tamano: file.tamano_bytes,
                updateInPlace: true,
                archivoDigitalId: file.id,
                documentoId: file.documento_id,
              },
            });

            // Marcar ArchivoDigital como procesando para evitar que lo tome la siguiente iteración
            await file.update({ estado_ocr: "procesando" });

            chunkProcesos.push({
              file,
              proceso,
              autorizacionInfo
              // NOTA IMPORTANTE DE OPTIMIZACIÓN DE MEMORIA:
              // No guardamos el `buffer: fileBuffer` en memoria. Al enviarlo a Python enseguida,
              // el Garbage Collector puede limpiar la memoria RAM de inmediato mientras esperamos.
            });

            // Iniciar envío a Python
            await this.enviarArchivoParaOCR(
              {
                buffer: fileBuffer,
                nombre: file.nombre_archivo,
                tamano: file.tamano_bytes,
                esSinNomenclatura: !parsedName.success,
                nombreOriginal: file.nombre_archivo,
              },
              proceso,
              autorizacionInfo,
              userId,
            );
          } catch (fileErr) {
            console.error(`Error preparando archivo individual ${file.nombre_archivo}:`, fileErr);
            // Marcar archivo como fallido directamente si no se pudo leer o enviar
            await file.update({
              estado_ocr: "fallido",
              metadatos_tecnicos: {
                ...file.metadatos_tecnicos,
                error: fileErr.message,
                failedAt: new Date(),
              },
            });

            if (global.activeOcrLock) {
              global.activeOcrLock.fallados++;
              global.activeOcrLock.errores.push({
                archivo: file.nombre_archivo,
                error: fileErr.message,
              });
            }
          }
        }

        // Esperar a que el sub-lote actual termine (completed o failed)
        if (chunkProcesos.length > 0) {
          await this.esperarSubLoteOCR(chunkProcesos.map((cp) => cp.proceso));
        }

        // Actualizar estadísticas del lock
        if (global.activeOcrLock) {
          for (const cp of chunkProcesos) {
            const dbProceso = await this.ocrProcesoModel.findByPk(cp.proceso.id);
            if (dbProceso) {
              if (dbProceso.estado === "completado") {
                global.activeOcrLock.completados++;
              } else if (dbProceso.estado === "fallado") {
                global.activeOcrLock.fallados++;
                global.activeOcrLock.errores.push({
                  archivo: cp.file.nombre_archivo,
                  error: dbProceso.error || "Fallo en procesamiento de OCR de Python",
                });
                
                // Actualizar metadatos técnicos en ArchivoDigital
                await cp.file.update({
                  estado_ocr: "fallido",
                  metadatos_tecnicos: {
                    ...cp.file.metadatos_tecnicos,
                    error: dbProceso.error || "Fallo en procesamiento de OCR de Python",
                    failedAt: new Date(),
                  },
                });
              }
            }
          }
        }
        
        procesados += chunk.length;
      }
    } finally {
      // Liberar el bloqueo al completar
      global.activeOcrLock = null;
    }
  }

  async esperarSubLoteOCR(procesos) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        try {
          const dbProcesos = await this.ocrProcesoModel.findAll({
            where: {
              id: { [Op.in]: procesos.map((p) => p.id) },
            },
          });

          const todosListos = dbProcesos.every((p) => ["completado", "fallado"].includes(p.estado));
          if (todosListos) {
            clearInterval(checkInterval);
            resolve(dbProcesos);
          }
        } catch (err) {
          console.error("Error en polling de sub-lote OCR:", err);
        }
      }, 5000);
    });
  }

  async reintentarArchivoIndividual(archivoId, userId) {
    const file = await this.archivoDigitalModel.findByPk(archivoId, {
      include: [
        {
          model: this.documentoModel,
          as: "documento",
          required: true,
          include: [
            {
              model: this.autorizacionModel,
              as: "autorizacion",
              required: true,
              include: [
                { model: this.municipioModel, as: "municipio" },
                { model: this.modalidadModel, as: "modalidad" },
                { model: this.tiposAutorizacionModel, as: "tipoAutorizacion" },
              ],
            },
          ],
        },
      ],
    });

    if (!file) {
      throw new Error(`Archivo digital con ID ${archivoId} no encontrado.`);
    }

    const currentLock = await this.obtenerMunicipioProcesando();
    if (currentLock) {
      throw new Error(`No se puede reintentar en este momento. Se está procesando el municipio: ${currentLock.municipioNombre || currentLock.municipioNum}.`);
    }

    const basePath = process.env.FILE_STORAGE_PATH || "./storage";
    const absolutePath = path.join(basePath, file.ruta_almacenamiento);
    const fileBuffer = await fs.readFile(absolutePath);

    const autorizacion = file.documento.autorizacion;
    const autorizacionInfo = {
      autorizacion,
      municipio: autorizacion.municipio,
      modalidad: autorizacion.modalidad,
      tipoAutorizacion: autorizacion.tipoAutorizacion,
    };

    const parsedName = this.parsearNombreArchivoSafe(file.nombre_archivo);

    const loteId = `lote_retry_${archivoId}_${Date.now()}`;
    const proceso = await this.ocrProcesoModel.create({
      lote_id: loteId,
      archivo_id: `temp_${Date.now()}`,
      nombre_archivo: file.nombre_archivo,
      autorizacion_id: autorizacion.id,
      user_id: userId,
      estado: "pendiente",
      metadata: {
        datosArchivo: {
          ...parsedName,
          esSinNomenclatura: !parsedName.success,
          nombreOriginal: file.nombre_archivo,
        },
        tamano: file.tamano_bytes,
      },
    });

    await file.update({ estado_ocr: "procesando" });

    await this.enviarArchivoParaOCR(
      {
        buffer: fileBuffer,
        nombre: file.nombre_archivo,
        tamano: file.tamano_bytes,
        esSinNomenclatura: !parsedName.success,
        nombreOriginal: file.nombre_archivo,
      },
      proceso,
      autorizacionInfo,
      userId,
    );

    // Ejecutar monitoreo del reintento en background y actualizar ArchivoDigital cuando acabe
    this.esperarSubLoteOCR([proceso]).then(async () => {
      const dbProceso = await this.ocrProcesoModel.findByPk(proceso.id);
      if (dbProceso) {
        if (dbProceso.estado === "completado") {
          await file.update({ estado_ocr: "completado" });
        } else {
          await file.update({
            estado_ocr: "fallido",
            metadatos_tecnicos: {
              ...file.metadatos_tecnicos,
              error: dbProceso.error || "Fallo en procesamiento de OCR de Python",
              failedAt: new Date(),
            },
          });
        }
      }
    }).catch(console.error);

    return { success: true };
  }

  async procesarDocumentoIndividual(archivoId, userId) {
    const file = await this.archivoDigitalModel.findByPk(archivoId, {
      include: [
        {
          model: this.documentoModel,
          as: "documento",
          required: true,
          include: [
            {
              model: this.autorizacionModel,
              as: "autorizacion",
              required: true,
              include: [
                { model: this.municipioModel, as: "municipio" },
                { model: this.modalidadModel, as: "modalidad" },
                { model: this.tiposAutorizacionModel, as: "tipoAutorizacion" },
              ],
            },
          ],
        },
      ],
    });

    if (!file) {
      throw new Error(`Archivo digital con ID ${archivoId} no encontrado.`);
    }

    const currentLock = await this.obtenerMunicipioProcesando();
    if (currentLock) {
      throw new Error(`No se puede procesar en este momento. Se está procesando el municipio: ${currentLock.municipioNombre || currentLock.municipioNum}.`);
    }

    const basePath = process.env.FILE_STORAGE_PATH || "./storage";
    const absolutePath = path.join(basePath, file.ruta_almacenamiento);
    const fileBuffer = await fs.readFile(absolutePath);

    const autorizacion = file.documento.autorizacion;
    const autorizacionInfo = {
      autorizacion,
      municipio: autorizacion.municipio,
      modalidad: autorizacion.modalidad,
      tipoAutorizacion: autorizacion.tipoAutorizacion,
    };

    const parsedName = this.parsearNombreArchivoSafe(file.nombre_archivo);

    const loteId = `lote_procesar_${archivoId}_${Date.now()}`;
    const proceso = await this.ocrProcesoModel.create({
      lote_id: loteId,
      archivo_id: `temp_${Date.now()}`,
      nombre_archivo: file.nombre_archivo,
      autorizacion_id: autorizacion.id,
      user_id: userId,
      estado: "pendiente",
      metadata: {
        datosArchivo: {
          ...parsedName,
          esSinNomenclatura: !parsedName.success,
          nombreOriginal: file.nombre_archivo,
        },
        tamano: file.tamano_bytes,
        updateInPlace: true,
        archivoDigitalId: file.id,
        documentoId: file.documento_id
      },
    });

    await file.update({ estado_ocr: "procesando" });

    await this.enviarArchivoParaOCR(
      {
        buffer: fileBuffer,
        nombre: file.nombre_archivo,
        tamano: file.tamano_bytes,
        esSinNomenclatura: !parsedName.success,
        nombreOriginal: file.nombre_archivo,
      },
      proceso,
      autorizacionInfo,
      userId,
    );

    // Ejecutar monitoreo del procesamiento en background y actualizar ArchivoDigital cuando acabe
    this.esperarSubLoteOCR([proceso]).then(async () => {
      const dbProceso = await this.ocrProcesoModel.findByPk(proceso.id);
      if (dbProceso) {
        if (dbProceso.estado === "completado") {
          await file.reload();
          if (file.estado_ocr !== "completado") {
            await file.update({ estado_ocr: "completado" });
          }
        } else {
          await file.update({
            estado_ocr: "fallido",
            metadatos_tecnicos: {
              ...file.metadatos_tecnicos,
              error: dbProceso.error || "Fallo en procesamiento de OCR de Python",
              failedAt: new Date(),
            },
          });
        }
      }
    }).catch(console.error);

    return { success: true };
  }
}

module.exports = new CargaMasivaService();
