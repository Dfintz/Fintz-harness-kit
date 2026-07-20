"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePkcePair = generatePkcePair;
const node_crypto_1 = __importDefault(require("node:crypto"));
function generatePkcePair() {
    const verifier = node_crypto_1.default.randomBytes(32).toString('hex');
    const challenge = node_crypto_1.default.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge, method: 'S256' };
}
//# sourceMappingURL=pkce.js.map