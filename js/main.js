var dummy = function () {};
var $ = $ || dummy;
var setCookie = setCookie || dummy;
var getCookie = getCookie || dummy;
var create_UUID = create_UUID || dummy;
var updateStatus = updateStatus || dummy;
var convertTimeToString = convertTimeToString || dummy;
var isMobileDevice = isMobileDevice || dummy;
var num_objects = 1;
var max_objects = 100;
var level = 0;
var uid = getCookie("uid") || create_UUID();
setCookie("uid", uid, 730);
var matchid = getCookie("matchid") || create_UUID().substring(0, 3);
setCookie("matchid", uid, 730);
var turns;
var match_turn;
var match_started;
var match_finished;
var match_owner;
var match_joined;
var limit;
var nickname = getCookie("nickname") || "Player1";

function init() {
  let id = $(".game").attr("data-matchid");
  if (!id) {
    changeGame();
  } else if (id.startsWith("Error")) {
    updateStatus(id);
    changeGame();
  } else if (id) {
    matchid = id;
    num_objects = Number($(".game").attr("data-num-objects"));
    max_objects = Number($(".game").attr("data-max-objects"));
    level = Number($(".game").attr("data-level"));
    turns = Number($(".game").attr("data-turns"));
    match_turn = Number($(".game").attr("data-turn"));
    limit = Number($(".game").attr("data-limit"));
    joinMatch();
    updateStatus("Match joined:<br>");
  }
  $(".gameparam").on("change", changeGame);
}

function changeGame() {
  num_objects = Number($("#num-objects").val());
  max_objects = Number($("#max-objects").val());
  turns = Number($("#turns").val());
  limit = Number($("#limit").val());
  level = Number($("#level").val());
  activateMatch();
  fillMatchLink();
}

function fillMatchLink(matchid) {
  let link = "https://" + window.location.hostname + "/match?id=" + matchid;
  $("#matchlink").val(link);
}

function activateMatch() {
  $(".help").hide();
  $.post("/setmatch", {
    matchid: matchid,
    num_objects: num_objects,
    max_objects: max_objects,
    level: level,
    turns: turns,
    limit: limit,
    nickname: nickname
  }).done(function (data) {
    if (data.error) {
    } else {
      match_owner = true;
      match_joined = true;
      matchStatus();
      $(".menu > *").hide();
      $("#leave-match-button").show();
      matchStatus();
    }
  });
}

function joinMatch() {
  $.post("/joinmatch", {
    matchid: matchid,
    nickname: nickname
  }).done(function (data) {
    if (data.error) {
      updateStatus(data.error);
    } else {
      updateStatus(data, 3000);
      match_joined = true;
      $("#menu > *").hide();
      $("#leave-match-button").show();
      matchStatus();
    }
  });
}
function leaveMatch() {
  $.post("/leavematch", {
    matchid: matchid
  }).done(function (data) {
    if (data.error) {
      updateStatus(data.error);
    } else {
      updateStatus(data, 3000);
    }
    match_joined = false;
    $("#menu > *").show();
    $("#leave-match-button").hide();
  });
}

function startMatch() {
  $.post("/startmatch", {
    matchid: matchid
  }).done(function (data) {
    if (data.error) {
    } else {
      updateStatus(data, 3000);
    }
  });
}

function forgetMatch() {
  $("#menu > *").show();
  $("#leave-match-button").hide();
  changeGame();
}

var g_match;
function matchStatus() {
  if (!matchid) {
    return;
  }
  $.get("/match-status", {
    matchid: matchid
  })
    .done(function (data) {
      g_match = data;
      if (data.error) {
        updateStatus(data.error);
        if (data.error.startsWith("No match")) {
          forgetMatch();
        }
      } else {
        if (data.users && data.users[uid] && data.users[uid].owner)
          match_owner = true;
        else match_owner = false;

        let users = Object.values(data.users);
        $("#match-players-num").text(users.length);
        let users_text = "";
        users.forEach((user) => {
          let klass = "";
          if (!user.present || !user.joined) {
            klass = "missing";
          }
          users_text +=
            "<span class='" + klass + "'>" + user.nickname + "&nbsp;</span>";
        });
        $("#match-players").html(users_text);
        if (data.started) {
          if (!match_started) {
            match_finished = false;
            if (match_joined) {
              initGuessTable();
            }
          } else {
            if (data.turn != match_turn) {
              updateStatus("");
              updateStatus("Nova runda: " + data.turn, 1000);

              setTimeout(() => {
                initGuessTable();
              }, 500);
            }
          }
        } else {
          if (data.finished && !match_finished) {
            match_finished = true;
            updateStatus(data.finished_message, 3000);
            showMatchResults();
          }
          if (match_owner) {
            $("#menu > *").show();
            $("#leave-match-button").hide();
          }
        }
        match_started = data.started;
        match_turn = data.turn;
        updateMatchInfo(data);
        if (match_started) setTimeout(matchStatus, 1000);
        else setTimeout(matchStatus, 4000);
      }
    })
    .fail(function () {
      updateStatus(
        "No answer from server.<br>Check your internet connection or try later."
      );
      setTimeout(matchStatus, 2000);
    });
}

function updateMatchInfo(status) {
  $("#match-info").show();
  $("#match-turn").text(status.turn + "/" + turns);
  let time_left = limit * 60 * 1000 - status.elapsed;
  if (time_left < 0) time_left = 0;
  $("#time-left").text(convertTimeToString(time_left));
  if (time_left < 10000) $("#time-left").css("color", "var(--orange)");
  else if (time_left < 60000)
    $("#time-left").css("color", "var(--darkendYellow)");
  else $("#time-left").css("color", "var(--darkendGreen)");
  let players_info = $("#match-players-info");
  players_info.empty();
  players_info.append(getUsersTable(Object.values(status.users)));
}

function getUsersTable(users, final) {
  let t = $("<table>");
  users.sort((a, b) => b.points - a.points);
  let last_points;
  let ii = 0;
  users.forEach((user, i) => {
    //if (!user.present) return;
    let tr = $("<tr>");
    t.append(tr);
    if (final) {
      if (user.points != last_points) {
        ii++;
      }
      last_points = user.points;
      tr.css("font-size", Math.max(22 - ii * 2, 16) + "px");
      tr.append($("<td>" + ii + ".</td>"));
    }
    if (user.uid == uid) {
      tr.append($("<td><strong>" + user.nickname + "</strong></td>"));
    } else {
      tr.append($("<td>" + user.nickname + "</td>"));
    }
    if (!user.present || !user.joined) tr.css("color", "var(--gray)");
    if (!final) tr.append($("<td>" + user.num_solved + "</td>"));
    tr.append($("<td>" + user.points + " (" + user.turns_played + ")</td>"));
  });
  return t;
}

function showMatchResults() {
  window.scrollTo(0, 0);
  $("#match-results").show();
  $("#match-results").empty();
  $("#match-results").append("<hr>");
  $("#match-results").append("<h4>Rezultati</h4>");
  $("#match-results").append(getUsersTable(Object.values(g_match.users), true));
}

$(window).on("load", () => {
  setTimeout(init, 100);
});
