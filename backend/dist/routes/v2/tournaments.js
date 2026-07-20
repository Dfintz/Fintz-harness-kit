"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const tournamentController_1 = require("../../controllers/tournamentController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
let tournamentController;
const getController = () => {
    if (!tournamentController) {
        tournamentController = new tournamentController_1.TournamentController();
    }
    return tournamentController;
};
router.post('/', (0, schemaValidation_1.validateSchema)(schemas_1.tournamentSchemas.create, 'body'), (req, res) => getController().createTournament(req, res));
router.get('/', (req, res) => getController().getTournaments(req, res));
router.get('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getTournamentById(req, res));
router.post('/:id/register', (0, schemaValidation_1.validateSchema)(schemas_1.tournamentSchemas.register, 'body'), (req, res) => getController().registerParticipant(req, res));
router.post('/:id/start', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().startTournament(req, res));
router.put('/:id/matches/:matchId', (0, schemaValidation_1.validateSchema)(schemas_1.tournamentSchemas.updateMatch, 'body'), (req, res) => getController().updateMatch(req, res));
//# sourceMappingURL=tournaments.js.map