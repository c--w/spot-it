const express = require("express");
const app = express();
const exphbs = require("express-handlebars");
const hbs = exphbs.create();
const http = require("http");
var server = http.createServer(app);
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const PORT = process.env.PORT;
var sessions = {};

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
app.set("views", "./src/views");

app.get("/", function (req, res) {
  console.log(user_info(req), "main");
  res.render("main", { layout: false });
});

function getUser(uid) {
  if (!sessions[uid]) {
    console.log("New user: ", uid);
    sessions[uid] = { nickname: "Player" };
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
