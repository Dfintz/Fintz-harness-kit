"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countTreeNodes = countTreeNodes;
function countTreeNodes(nodes) {
    return nodes.reduce((count, node) => {
        const current = node;
        return count + 1 + countTreeNodes(current.children ?? []);
    }, 0);
}
//# sourceMappingURL=fleetController.tree.js.map