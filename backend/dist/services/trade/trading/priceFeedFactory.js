"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultPriceFeed = void 0;
exports.createPriceFeedProvider = createPriceFeedProvider;
const UEXPriceFeed_1 = require("./UEXPriceFeed");
const UIFPriceFeed_1 = require("./UIFPriceFeed");
function createPriceFeedProvider(name = 'uif') {
    switch (name) {
        case 'uex':
            return new UEXPriceFeed_1.UEXPriceFeed();
        case 'uif':
        default:
            return new UIFPriceFeed_1.UIFPriceFeed();
    }
}
exports.defaultPriceFeed = createPriceFeedProvider('uif');
//# sourceMappingURL=priceFeedFactory.js.map