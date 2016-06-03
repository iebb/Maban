var sanitize = require("sanitize-filename");
var request = require('request');
var crypto = require('crypto');
var mkdirp = require('mkdirp');
var prompt = require('prompt');
var util = require('util');
var path = require('path')
var fs = require("fs");
var j = request.jar();
var getDirName = path.dirname;
var request = request.defaults({ jar: j });

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
/* fuck self-signed cert */

var userId, studentId, nickname;

function md5(str) {
	var md5sum = crypto.createHash('md5');
	md5sum.update(str);
	str = md5sum.digest('hex');
	return str;
};

function writeFile(path, contents, cb) {
	mkdirp(getDirName(path), function(err) {
		if (err) return cb(err);
		fs.writeFile(path, contents, cb);
	});
}

function doFetchProblem(problemId) {
	console.log("Fetching", problemId);
	request.get('https://eden.sysu.edu.cn/get-problem-by-id?problemId=' + problemId, function(e, r, body) {
		body = JSON.parse(body);
		if (body.err) {
			console.log(msg);
			return PromptLogin();
		} else {
			var devFile = "", isCpp = 1, i = 0;
			folder = sanitize(body.data.id + " " + body.data.title);
			config = JSON.parse(body.data.config);
			writeFile("./saved/" + folder + "/problem.txt", body.content);
			for (i in config.code_files.answer) {
				filename = config.code_files.answer[i];
				writeFile("./saved/" + folder + "/" + filename, "");
				devFile += util.format("[Unit%d]\nFileName=%s\n", ++i, filename);
			}
			for (i in body.data.supportFiles) {
				for (filename in body.data.supportFiles[i]) {
					writeFile("./saved/" + folder + "/" + filename, body.data.supportFiles[i][filename]);
					devFile += util.format("[Unit%d]\nFileName=%s\n", ++i, filename);
				}
			}
			devFile = util.format("[Project]\nFileName=Project%s.dev\nName=%s\n\
				UnitCount=%s\nIsCpp=%d\nType=1\nVer=2\n",
				problemId, problemId, i, isCpp) + devFile;
			writeFile("./saved/" + folder + "/Project" + problemId + ".dev", devFile);
		}
	});
}

function doFetchCourseAsgns(courseId) {
	request.get('https://eden.sysu.edu.cn/get-course-assignments?courseId=' + courseId + '&userId=' + userId, function(e, r, body) {
		body = JSON.parse(body);
		if (body.err) {
			console.log(msg);
			return PromptLogin();
		} else {
			asgns = body.data;
			for (i in asgns) {
				console.log(asgns[i].problemId, asgns[i].title);
				doFetchProblem(asgns[i].problemId);
			}
		}
	});
}

function doFetchCourses() {
	request.get('https://eden.sysu.edu.cn/courses?userId=' + userId, function(e, r, body) {
		body = JSON.parse(body);
		if (body.err) {
			console.log(msg);
			return PromptLogin();
		} else {
			courses = body.data.creating.concat(body.data.participating);
			for (i in courses) {
				console.log(courses[i].courseId, courses[i].courseName);
				doFetchCourseAsgns(courses[i].courseId);
			}
		}
	});
}
function doLogin(result) {
	console.log(md5(result.password));
	request.post({
		url: 'https://eden.sysu.edu.cn/signin',
		form: {
			'username': result.username,
			'password': md5(result.password)
		}
	}, function(err, resp, body) {
		body = JSON.parse(body);
		if (body.err) {
			console.log(msg);
			return PromptLogin();
		} else {
			userId = body.data.id;
			studentId = body.data.studentId;
			nickname = body.data.nickname;
			doFetchCourses();
		}
	})
}
function PromptLogin() {
	prompt.start();
	prompt.get([{
		name: 'username',
		required: true
	}, {
		name: 'password',
		hidden: true,
		replace: '*',
		required: true
	}], function(err, result) {
		if (err) { return onErr(err); }
		console.log("logging in....");
		doLogin(result);
	});
}
PromptLogin();