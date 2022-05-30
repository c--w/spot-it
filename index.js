const express = require("express");
const app = express();
const exphbs = require("express-handlebars");
const hbs = exphbs.create();
const http = require("http");
var server = http.createServer(app);
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const PORT = process.env.PORT || 8080;
var sessions = {};
var matches = {};
var total_objects = 1306;

app.engine("handlebars", hbs.engine);
app.set("view engine", "handlebars");
app.use(express.static(__dirname + "/"));
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);
app.use(cookieParser());
app.use(bodyParser.json());
app.set("views", "./views");

app.get("/", function (req, res) {
  console.log(user_info(req), "main");
  res.render("main", { layout: false });
});

server.listen(PORT);
console.log("Started!", PORT);

app.post("/setmatch", function (req, res) {
  let user = getUser(req.cookies.uid);
  let matchid = req.body.matchid;
  console.log("setmatch", matchid);
  let match = {};
  matches[matchid] = match;
  let nickname = req.body.nickname;
  match.num_objects = Number(req.body.num_objects);
  match.max_objects = Number(req.body.max_objects);
  match.turns = Number(req.body.turns);
  match.limit = Number(req.body.limit);
  match.turn = 1;
  match.started = 0;
  match.finished = 0;
  match.elapsed = 0;
  match.users = {};
  addUser2Match(match, user, nickname);
  match.users_solved = new Array(match.turns);
  console.log(
    user_info(req),
    "setmatch",
    match.turns,
    match.limit,
  );
  sendResponse("Turnir je kreiran!", res);
});

function checkOwner(match) {
  let owner = Object.values(match.users).find(
    (user) => user.owner && user.present && user.joined
  );
  if (owner) return true;
  let present_user = Object.values(match.users).find(
    (user) => user.present && user.joined
  );
  if (present_user) {
    present_user.owner = true;
    return true;
  } else {
    return false;
  }
}

function addUser2Match(match, user, nickname) {
  let matchuser = match.users[user.uid];
  if (!matchuser) {
    matchuser = {};
    matchuser.uid = user.uid;
    match.users[user.uid] = matchuser;
    matchuser.points = 0;
    matchuser.turns_played = 0;
  }
  matchuser.solved = new Array(match.num_objects);
  matchuser.solved.fill(0);
  matchuser.solved_num = 0;
  matchuser.nickname = nickname;
  matchuser.present = true;
  matchuser.joined = true;
  matchuser.last_check = Date.now();
  checkOwner(match);
  console.log("addUser2Match", nickname);
  return matchuser;
}

app.post("/joinmatch", function (req, res) {
  let user = getUser(req.cookies.uid);
  let matchid = req.body.matchid;
  let nickname = req.body.nickname;
  console.log("Joined:", nickname);
  let match = matches[matchid];
  if (!match) {
    sendResponse({ error: "No match for id: " + matchid }, res);
    return;
  }
  let matchuser = addUser2Match(match, user, nickname);
  let resp_text = "Joined!";
  if (match.started)
    resp_text += "<br>Match already in progress, start playing!";
  else if (!matchuser.owner)
    resp_text += "<br>Wait for owner to start the match!";
  sendResponse(resp_text, res);
});

app.post("/leavematch", function (req, res) {
  let user = getUser(req.cookies.uid);
  console.log("Left:", user.nickname);
  let matchid = req.body.matchid;
  let match = matches[matchid];
  if (!match) {
    sendResponse({ error: "No match for id: " + matchid }, res);
    return;
  }
  let matchuser = match.users[user.uid];
  if (matchuser) {
    matchuser.joined = false;
    matchuser.owner = false;
    console.log("leavematch", matchuser.nickname);
  }
  checkOwner(match);
  sendResponse("Match left.", res);
});

app.post("/startmatch", function (req, res) {
  let matchid = req.body.matchid;
  console.log("startmatch", matchid);
  let match = matches[matchid];
  if (!match) {
    sendResponse({ error: "No match for id: " + matchid }, res);
    return;
  }
  match.start_time = Date.now();
  match.turn = 1;
  match.started = 1;
  match.finished = 0;
  Object.values(match.users).forEach((user) => {
    user.last_result = null;
    user.points = 0;
    user.turns_played = 0;
    if (!user.present) {
      delete match.users[user.uid];
    }
  });
  initTurn(match);
  setTimeout(checkMatchTime, 100, match);
  sendResponse("Turnir je pokrenut!", res);
});

function initTurn(match) {
  console.log("Init turn:", match.turn);
  match.start_time = Date.now();
  match.users_solved[match.turn - 1] = [];
  match.multiple_objects = [];
  Object.values(match.users).forEach((user) => {
    user.solved = new Array(match.num_objects);
    user.solved.fill(0);
    user.solved_num = 0;
    user.turn_solved = false;
  });
  while (match.multiple_objects.length < match.num_objects) {
    let ind = Math.floor(Math.random() * total_objects);
    if (!match.multiple_objects.includes(ind)) {
      match.multiple_objects.push(ind);
	}
  }
}

function allPresentSolved(match) {
  return !Object.values(match.users).find(
    (user) => user.joined && user.present && !user.turn_solved
  );
}

const pointsMap = [10, 8, 6, 4, 2, 1];

function checkMatchTime(match) {
  Object.values(match.users).forEach((user) => {
    if (Date.now() - user.last_check > 15000) {
      user.present = false;
      user.owner = false;
    } else {
      user.present = true;
    }
  });
  if (!checkOwner(match)) {
    console.log("No active player");
    match.started = 0;
    match.finished = 1;
    match.finished_message = "All players left the match.";
    return;
  }
  match.elapsed = Date.now() - match.start_time;
  if (match.elapsed / (1000 * 60) < match.limit && !allPresentSolved(match)) {
    setTimeout(checkMatchTime, 100, match);
    return;
  }
  console.log(match.elapsed, match.limit); 	
  let users_solved_some = Object.values(match.users).filter(
    (user) => user.solved_num > 0 && !user.turn_solved
  );
  users_solved_some.sort((a, b) => b.solved_num - a.solved_num);
  let i = match.users_solved[match.turn - 1].length - 1;
  let last_solved_num = 0;
  users_solved_some.forEach((user) => {
    if (user.solved_num != last_solved_num) i++;
    last_solved_num = user.solved_num;
    let points = Math.floor(((pointsMap[i] || 1) * match.num_objects) / 2);
    user.points += points;
  });
  if (match.turn >= match.turns) {
    console.log("Match finished");
    match.started = 0;
    match.finished = 1;
    match.finished_message = "Turnir je završen!";
    return;
  } else {
    match.turn++;
    initTurn(match);
    setTimeout(checkMatchTime, 100, match);
  }
}

function storeMatchUserResult(matchid, uid, object_num) {
  var ret = 0;
  let match = matches[matchid];
  let matchuser = match.users[uid];
  if (!matchuser) {
    console.log("No user for id:", uid, " all uids:", Object.keys(match.users));
    return 0;
  }
  let ind = match.multiple_objects.indexOf(object_num);
  console.log(match.multiple_objects, object_num, ind);
  if (ind !== -1) {
    ret = 1;
    matchuser.solved[ind] = 1;
    matchuser.solved_num = matchuser.solved.reduce((p, a) => p + a, 0);
    if (matchuser.solved_num == match.num_objects) {
      if (!matchuser.turn_solved) {
        matchuser.points +=
          (pointsMap[match.users_solved[match.turn - 1].length] || 1) *
          match.num_objects;
        matchuser.turns_played++;
      }
      matchuser.turn_solved = true;
      match.users_solved[match.turn - 1].push(matchuser);
      console.log("Turn solved by: ", matchuser.nickname);
    }
  }
  return ret;
}

app.get("/match-status", function (req, res) {
  let matchid = req.query.matchid;
  let match = matches[matchid];
  if (!match) {
    sendResponse({ error: "No match for id: " + matchid }, res);
    return;
  }
  if (match.users[req.cookies.uid])
    match.users[req.cookies.uid].last_check = Date.now();
  sendResponse(match, res);
});

app.get("/match", function (req, res) {
  let matchid = req.query.id;
  let match = matches[matchid];
  if (!match) {
    console.log("No match for: ", matchid);
    res.render("main", {
      layout: false,
      matchid: "ERROR: no match for id: " + matchid
    });
    return;
  }
  res.render("main", {
    layout: false,
    matchid: matchid,
    num_objects: match.num_objects,
    max_objects: match.max_objects,
    turn: match.turn,
    turns: match.turns,
    limit: match.limit
  });
  console.log("Match link opened: ", matchid);
});

app.post("/spotted", function (req, res) {
  let object_num = Number(req.body.object_num);
  let matchid = req.body.matchid;
  console.log("spotted", matchid, object_num);
  let uid = req.cookies.uid;
  let match = {};
  if (matchid) {
    match = matches[matchid];
    if (!match) {
      sendResponse({ error: "No match for id: " + matchid }, res);
      return;
    }
  }
  let valid = -1;
  if (matchid && !match.finished) {
    valid = storeMatchUserResult(matchid, uid, object_num);
  }
  sendResponse({ result: valid }, res);
});

app.get("/sessions/:m", function (req, res) {
  let m = Number(req.params.m);
  let active = Object.values(sessions).filter(
    (s) => Date.now() - s.time < m * 60 * 1000
  );
  sendResponse(active, res);
});

function getUser(uid) {
  if (!sessions[uid]) {
    console.log("New user: ", uid);
    sessions[uid] = { nickname: "Player1" };
    sessions[uid].uid = uid;
    console.log("Sessions", Object.keys(sessions).length);
  }
  sessions[uid].time = Date.now();
  return sessions[uid];
}

function user_info(req) {
  let ip = req.headers["x-forwarded-for"];
  let uid = req.cookies.uid || "nouid";
  let user = getUser(uid);
  if (user && user.city) {
    return (
      ip +
      " " +
      user.city +
      " " +
      user.latlon +
      " " +
      (user.nickname || uid.substring(0, 3)) +
      " ::"
    );
  } else {
    setTimeout(
      (user) => {
        http
          .get("http://ip-api.com/json/" + ip, (res) => {
            res.on("data", (d) => {
              let obj = JSON.parse(d);
              user.city = obj.city;
              user.latlon = obj.lat + " " + obj.lon;
            });
          })
          .on("error", (e) => {
            console.error(e);
          });
      },
      0,
      user
    );
    return ip + " " + uid.substring(0, 3) + " ::";
  }
}

function sendResponse(obj, res) {
  res.writeHead(200, {
    "Content-Type": "application/json"
  });
  res.write(JSON.stringify(obj));
  res.end();
}

function log(msg, param1, param2, param3, param4, param5, param6) {
  let e, m, pos;
  if (msg && msg.stack) {
    var a = msg.stack.split(/\n/);
    m = a[0];
    pos = a[1] ? a[1].trim() : "";
  } else {
    e = new Error();
    var a = e.stack.split(/\n/);
    pos = a[2] ? a[2].trim() : a[1].trim();
    m = JSON.stringify(msg);
    if (param1) param1 = JSON.stringify(param1);
    if (param2) param2 = JSON.stringify(param2);
    if (param3) param3 = JSON.stringify(param3);
    if (param4) param4 = JSON.stringify(param4);
    if (param5) param5 = JSON.stringify(param5);
    if (param6) param6 = JSON.stringify(param6);
  }
  var now = Date.now() - new Date().getTimezoneOffset() * 60000;
  console.log(
    new Date(now).toJSON() + " " + pos + ": " + m,
    param1 || "",
    param2 || "",
    param3 || "",
    param4 || "",
    param5 || "",
    param6 || ""
  );
}
