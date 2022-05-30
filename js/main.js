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
var matchid = getCookie("matchid").substring(0, 3) || create_UUID().substring(0, 3);
setCookie("matchid", matchid, 730);
var turns;
var match_turn;
var match_started;
var match_finished;
var match_owner;
var match_joined;
var limit;
var nickname = getCookie("nickname") || "Player1";
var num_icons = 944;

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
    $(".game").on("click", badClick);
	$(".help").on("click", hide);
	if(nickname == 'Player1') {
		$('#nickname-div').show();
	}
}

function setNick() {
	nickname = $("#nickname").val();
	setCookie("nickname", nickname, 730);
	$('#nickname-div').hide();
}
function hide() {
	$(this).hide();
}

var g_last_click = Date.now();
function badClick() {
    if (Date.now() - g_last_click < 5000) {
        updateStatus("You are in penalty! Even good clicks are ignored!", 1000);
    } else {
        updateStatus("Bad click! 5 sec penalty!", 1000);
    }
    g_last_click = Date.now();
}

function changeGame() {
    num_objects = Number($("#num-objects").val());
    max_objects = Number($("#max-objects").val());
    turns = Number($("#turns").val());
    limit = Number($("#limit").val());
    level = Number($("#level").val());
    matchid = getCookie("matchid").substring(0, 3) || create_UUID().substring(0, 3);
    setCookie("matchid", matchid, 730);
    activateMatch();
    fillMatchLink();
}

function fillMatchLink() {
    let link = window.location.origin + "/match?id=" + matchid;
    $("#matchlink").val(link);
}

function rand(low, high) {
    return low + Math.random() * (high - low);
}
function initPlayField() {
	$("#to-spot-div").empty();
	let rnd_pos = [];
    g_match.multiple_objects.forEach((pos) => {
        let img = $('<img class="to-spot">');
        let ind = Math.floor(num_icons / max_objects * pos);
        img.attr('src', '/icons/ico' + ind + '.png');
        img.attr('pos', pos);
		$("#to-spot-div").append(img);
		var rnd;
		do {
			rnd = Math.floor(rand(0, max_objects));
		} while(rnd_pos.includes(rnd))
		rnd_pos.push(rnd);
    });
	console.log(rnd_pos);
    let top_gap = $('.menu').height() + $("#to-spot-div").outerHeight();
    let bottom_gap = $('#game-info').height();
    $('.game').empty();
    let w = window.innerWidth;
    let h = window.innerHeight - top_gap - bottom_gap;
    let k = w / h;
    let rows = Math.sqrt(max_objects / k);
    let cols = rows * k;
    rows = Math.ceil(rows);
    cols = Math.ceil(cols);
    let ow = w / cols;
    let oh = h / rows;
    let pos = 0;
	let placed = 0;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            let transform = "translatex(-50%) translatey(-50%) ";
            let posx = j * ow + ow / 2 + rand(-ow / 4, ow / 4);
            let posy = top_gap + i * oh + oh / 2 + rand(-oh / 4, oh / 4);
            let img = $('<img class="object">');
            img.css('top', posy + "px");
            img.css('left', posx + "px");
            img.css('height', oh + "px");
            img.css('width', ow + "px");
            let ind;
            if (rnd_pos.includes(pos)) {
                ind = Math.floor(num_icons / max_objects * g_match.multiple_objects[placed]);
                img.addClass('clikable');
                img.data('pos', g_match.multiple_objects[placed]);
				console.log(pos, placed, g_match.multiple_objects[placed]);
				placed++;
            } else {
                ind = Math.floor(rand(0, num_icons));
            }
            img.attr('src', '/icons/ico' + ind + '.png');
            let scale = rand(0.5, 0.75);
            transform += "scale(" + scale + ") ";
            let rotate = rand(-45, 45);
            transform += "rotate(" + rotate + "deg) ";
            img.css('transform', transform);
            $('.game').append(img);
            pos++;
        }
    }
	console.log(pos);
    $('.game img.clikable').on("click", spotted);
}

function spotted(event) {
	event.stopPropagation();
    if (Date.now() - g_last_click < 5000) {
        updateStatus("You are still in penalty! Even good clicks are ignored!", 1000);
		return;
	}
    let pos = $(this).data('pos');
    $('.to-spot[pos=' + pos + ']').addClass('spotted');
    $.post("/spotted", {
        matchid: matchid,
        object_num: pos
    }).done(function (data) {
        if (data.result == 1)
            updateStatus("Correct!", 1000);
        else if (data.result == 0)
            updateStatus("Incorrect!", 1000);
        else if (data.result == -1)
            updateStatus("Wrong match id or match finished", 3000);
    });
}

function showHide(match_on) {
    if (match_on) {
        $(".menu > *").hide();
        $("#leave-match-button").show();
        $("#to-spot-div").show();
    } else {
        $(".menu > *").show();
        $("#leave-match-button").hide();
        $("#to-spot-div").hide();
    }
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
        if (data.error) {}
        else {
            match_owner = true;
            match_joined = true;
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
            showHide(1);
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
        showHide(0);
        changeGame();
    });
}

function startMatch() {
    $.post("/startmatch", {
        matchid: matchid
    }).done(function (data) {
        if (data.error) {}
        else {
            updateStatus(data, 3000);
        }
    });
}

function forgetMatch() {
    $(".menu > *").show();
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
            else
                match_owner = false;

            if (data.started) {
                if (!match_started) {
                    match_finished = false;
                    if (match_joined) {
                        showHide(1);
                        initPlayField();
                    }
                } else {
                    if (data.turn != match_turn) {
                        updateStatus("");
                        updateStatus("Nova runda: " + data.turn, 1000);
                        setTimeout(() => {
                            initPlayField();
                        }, 500);
                    }
                }
            } else {
                if (data.finished && !match_finished) {
                    match_finished = true;
                    updateStatus(data.finished_message, 3000);
                    showMatchResults();
                    if (match_owner) {
                        showHide(0);
                    }
                    $('.game').empty();
                }
            }
            match_started = data.started;
            match_turn = data.turn;
            updateMatchInfo(data);
            if (match_started)
                setTimeout(matchStatus, 1000);
            else
                setTimeout(matchStatus, 4000);
        }
    })
    .fail(function () {
        updateStatus(
            "No answer from server.<br>Check your internet connection or try later.");
        setTimeout(matchStatus, 2000);
    });
}

function updateMatchInfo(status) {
    $("#match-info").show();
    $("#match-turn").text(status.turn + "/" + turns);
    let time_left = limit * 60 * 1000 - status.elapsed;
    if (time_left < 0)
        time_left = 0;
    $("#time-left").text(convertTimeToString(time_left));
    if (time_left < 10000)
        $("#time-left").css("color", "var(--orange)");
    else if (time_left < 60000)
        $("#time-left").css("color", "var(--darkendYellow)");
    else
        $("#time-left").css("color", "var(--darkendGreen)");
    let players_info = $("#match-players-info");
    players_info.empty();
    players_info.append(getUsersTable(Object.values(status.users)));
    let users = Object.values(status.users);
    $("#match-players-num").text(users.length);
    let users_text = "";
    users.sort((a, b) => b.points - a.points);
    users.forEach((user) => {
        let klass = "";
        if (!user.present || !user.joined) {
            klass = "missing";
        }
        users_text +=
        "<span class='" + klass + "'>" + user.nickname + "&nbsp;"+user.points+"</span>";
    });
    $("#match-players").html(users_text);
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
        if (!user.present || !user.joined)
            tr.css("color", "var(--gray)");
        if (!final)
            tr.append($("<td>" + user.num_solved + "</td>"));
        tr.append($("<td>" + user.points + " (" + user.turns_played + ")</td>"));
    });
    return t;
}

function showMatchResults() {
    window.scrollTo(0, 0);
    $("#match-results").show();
    $("#match-results").empty();
    $("#match-results").append("<h4>Scores</h4>");
    $("#match-results").append(getUsersTable(Object.values(g_match.users), true));
}

function copyMatchLinkClipboard(id) {
    var copyText = document.getElementById(id);
    copyText.select();
    document.execCommand("Copy");
    if (isMobileDevice()) {
        let text = "Spot it match " + level + "\n" + copyText.value;
        let shareData = {
            title: "Spot it match",
            text: text
        };
        try {
            window.Android.share(text);
        } catch (err) {
		}
        try {
            navigator.share(shareData);
        } catch (err) {
		}
		updateStatus("Link is copied", 2000);
    } else {
        updateStatus("Link is copied", 2000);
    }
}

$(window).on("load", () => {
    setTimeout(init, 100);
});
