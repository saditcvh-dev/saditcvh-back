const netdataService = require('../services/netdata.service');

exports.getStorageMetrics = async (req, res) => {
    try {
        const data = await netdataService.getStorageData();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getLiveMetrics = async (req, res) => {
    try {
        const data = await netdataService.getLivePerformance();
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};