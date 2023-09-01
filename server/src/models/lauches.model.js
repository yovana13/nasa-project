const axios = require("axios");

const launchesDatabase = require("./launches.mongo");
const planets = require("./planets.mongo");
const { response } = require("../app");
const launches = new Map();

const DEFAULT_FILUGHT_NUMBER = 100;

// const launch = {
//   flightNumber: 100, //flight_number
//   mission: "Kepler", //name
//   rocket: "Expolre IS1", //rocket.name
//   launchDate: new Date("December 27, 2030"), //date_local
//   target: "Kepler-296 A f", //not applicable
//   customers: ["ZTM", "NASA"],
//   upcoming: true, //upcoming
//   success: true, //success
// };

// saveLaunch(launch);

const SPACEX_API_URL = "https://api.spacexdata.com/v4/launches/query";
async function populateLaunches() {
  const response = await axios.post(SPACEX_API_URL, {
    query: {},
    options: {
      pagination: false,
      populate: [
        {
          path: "rocket",
          select: {
            name: 1,
          },
        },
        {
          path: "payloads",
          select: {
            customers: 1,
          },
        },
      ],
    },
  });

  if (response.status !== 200) {
    console.log("problem downloading launch data");
    throw new Error("Launch data download failed");
  }

  const launchDocs = response.data.docs;
  for (const launchDoc of launchDocs) {
    const payloads = launchDoc["payloads"];
    const customers = payloads.flatMap(payload => {
      return payload["customers"];
    });

    const launch = {
      flightNumber: launchDoc["flight_number"],
      mission: launchDoc["name"],
      rocket: launchDoc["rocket"]["name"],
      launchDate: launchDoc["date_local"],
      upcoming: launchDoc["upcoming"],
      success: launchDoc["success"],
      customers,
    };

    console.log(`${launch.flightNumber} ${launch.mission}`);

    await saveLaunch(launch);
    //TODO: populate launches collecion...
  }
}
async function loadLaunchData() {
  const firstLaunch = await findLaunch({
    flightNumber: 1,
    rocket: "Falcon 1",
    mission: "FalconSat",
  });
  if (firstLaunch) {
    console.log("Launch data already loaded");
  } else {
    await populateLaunches();
  }
}

async function getAllLaunches(skip, limit) {
  return launchesDatabase
    .find({}, { _id: 0, __v: 0 })
    .sort({ flightNumber: 1 })
    .skip(skip)
    .limit(limit);
}

async function getLatestFlightNumber() {
  const latetstLaunch = await launchesDatabase.findOne().sort("-flightNumber");

  if (!latetstLaunch) {
    return DEFAULT_FILUGHT_NUMBER;
  }
  return latetstLaunch.flightNumber;
}

async function saveLaunch(launch) {
  // const planet = await planets.findOne({
  //   keplerName: launch.target,
  // });

  // if (!planet) {
  //   throw new Error("No matching planet found");
  // }

  await launchesDatabase.findOneAndUpdate(
    { flightNumber: launch.flightNumber },
    launch,
    {
      upsert: true,
    }
  );
}

async function scheduleNewLaunch(launch) {
  const planet = await planets.findOne({
    keplerName: launch.target,
  });

  if (!planet) {
    throw new Error("No matching planet found");
  }

  const newFlightNumber = (await getLatestFlightNumber()) + 1;

  const newLaunch = Object.assign(launch, {
    success: true,
    upcoming: true,
    customers: ["Zero to Mastery", "NASA"],
    flightNumber: newFlightNumber,
  });

  await saveLaunch(newLaunch);
}

async function findLaunch(filter) {
  return await launchesDatabase.findOne(filter);
}

async function existsLaunchWithId(launchId) {
  return await launchesDatabase.findOne({
    flightNumber: launchId,
  });
}

async function abortLaunchWithId(launchId) {
  const aborted = await launchesDatabase.updateOne(
    {
      flightNumber: launchId,
    },
    {
      upcoming: false,
      success: false,
    }
  );

  return aborted.modifiedCount === 1;
}

module.exports = {
  loadLaunchData,
  getAllLaunches,
  existsLaunchWithId,
  abortLaunchWithId,
  scheduleNewLaunch,
};
