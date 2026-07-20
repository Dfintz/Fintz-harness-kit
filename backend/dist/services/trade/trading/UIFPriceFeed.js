"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIFPriceFeed = void 0;
const UIFService_1 = require("./UIFService");
class UIFPriceFeed {
    name = 'UIF';
    async searchItems(options) {
        return UIFService_1.uifService.searchItems(options);
    }
    async getItemDetails(itemName) {
        return UIFService_1.uifService.getItemDetails(itemName);
    }
    async getItemPrices(itemName) {
        return UIFService_1.uifService.getItemPrices(itemName);
    }
    async findBestBuyLocation(itemName, nearLocation) {
        return UIFService_1.uifService.findBestBuyLocation(itemName, nearLocation);
    }
    async findBestSellLocation(itemName, nearLocation) {
        return UIFService_1.uifService.findBestSellLocation(itemName, nearLocation);
    }
    async comparePrices(itemName) {
        return UIFService_1.uifService.comparePrices(itemName);
    }
    async getItemsAtLocation(location) {
        return UIFService_1.uifService.getItemsAtLocation(location);
    }
    async getTradingOpportunities(from, to, minMargin) {
        return UIFService_1.uifService.getTradingOpportunities(from, to, minMargin);
    }
    clearCache() {
        UIFService_1.uifService.clearCache();
    }
    clearItemCache(itemName) {
        UIFService_1.uifService.clearItemCache(itemName);
    }
    getStatus() {
        const circuit = UIFService_1.uifService.getCircuitStatus();
        return {
            name: this.name,
            healthy: circuit.healthy,
            details: { state: circuit.state },
        };
    }
}
exports.UIFPriceFeed = UIFPriceFeed;
//# sourceMappingURL=UIFPriceFeed.js.map