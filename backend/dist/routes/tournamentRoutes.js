"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTournamentRoutes = setTournamentRoutes;
const express_1 = require("express");
const tournamentController_1 = require("../controllers/tournamentController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
const authStack = [auth_1.authenticateToken];
let tournamentController;
const getController = () => {
    if (!tournamentController) {
        tournamentController = new tournamentController_1.TournamentController();
    }
    return tournamentController;
};
function setTournamentRoutes(app) {
    router.post('/tournaments', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.tournamentSchemas.create, 'body'), (req, res) => getController().createTournament(req, res));
    router.get('/tournaments', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.tournamentQuerySchemas.listQuery, 'query'), (req, res) => getController().getTournaments(req, res));
    router.get('/tournaments/:id', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.tournamentQuerySchemas.idParam, 'params'), (req, res) => getController().getTournamentById(req, res));
    router.post('/tournaments/:id/register', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.tournamentQuerySchemas.registerBody, 'body'), (req, res) => getController().registerParticipant(req, res));
    router.post('/tournaments/:id/start', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.tournamentQuerySchemas.idParam, 'params'), (req, res) => getController().startTournament(req, res));
    router.put('/tournaments/:id/matches/:matchId', ...authStack, (0, schemaValidation_1.validateSchema)(schemas_1.tournamentSchemas.updateMatch, 'body'), (req, res) => getController().updateMatch(req, res));
    app.use('/api', router);
}
//# sourceMappingURL=tournamentRoutes.js.map