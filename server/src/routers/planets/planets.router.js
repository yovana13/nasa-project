const exppress = require('express');
const { httpGetAllPlanets } = require("./planets.controller");

const planetsRouter = exppress.Router();

planetsRouter.get("/", httpGetAllPlanets);

module.exports = planetsRouter;