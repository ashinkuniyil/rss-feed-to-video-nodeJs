var express = require("express");
var fs = require("fs");
const _ = require("lodash");
let parser = new (require("rss-parser"))();
var text2png = require("text2png");
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpegProbPath = require('@ffprobe-installer/ffprobe').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffmpegProbPath);
var videoshow = require("videoshow");
const gTTS = require("gtts");
const getMP3Duration = require("get-mp3-duration");
const Youtube = require("youtube-api");
const readJson = require("r-json");
const Lien = require("lien");
const Logger = require("bug-killer");
const opn = require("opn");
const prettyBytes = require("pretty-bytes");


// const CREDENTIALS = readJson(`credentials.json`);

// let oauth = Youtube.authenticate({
//   type: "oauth",
//   client_id: CREDENTIALS.web.client_id,
//   client_secret: CREDENTIALS.web.client_secret,
// });

// opn(
//   oauth.generateAuthUrl({
//     access_type: "offline",
//     scope: ["https://www.googleapis.com/auth/youtube.upload"],
//   })
// );

function initializeYoutube() {
  oauth.getToken(lien.query.code, (err, tokens) => {
    if (err) {
      lien.lien(err, 400);
      return Logger.log(err);
    }

    Logger.log("Got the tokens.");

    oauth.setCredentials(tokens);

    lien.end(
      "The video is being uploaded. Check out the logs in the terminal."
    );

    var req = Youtube.videos.insert(
      {
        resource: {
          // Video title and description
          snippet: {
            title: "Testing YoutTube API NodeJS module",
            description: "Test video upload via YouTube API",
          },
          // I don't want to spam my subscribers
          status: {
            privacyStatus: "private",
          },
        },
        // This is for the callback function
        part: "snippet,status",

        // Create the readable stream to upload the video
        media: {
          body: fs.createReadStream("assets/How_much.mp4"),
        },
      },
      (err, data) => {
        console.log("Done.");
        process.exit();
      }
    );
  });
  setInterval(function () {
    Logger.log(
      `${prettyBytes(req.req.connection._bytesDispatched)} bytes uploaded.`
    );
  }, 250);
}

var router = express.Router();
var feedList = JSON.parse(fs.readFileSync("assets/feed.json"));

async function actConverion() {
  let feed = await fetchRSS();
  const regxRemoveNewline = /\r?\n|\r/g;
  const regexRemoveUnsupportFileName = /[/\\?%*:|"<>]/g;
  if (!_.isEqual(feedList[0], feed.items[0])) {
    var content, isEqual, gtts;
    feed.items.forEach((item) => {
      isEqual = false;
      feedList.forEach((localItem) => {
        if (_.isEqual(item, localItem)) {
          isEqual = true;
        }
      });
      if (!isEqual) {
        content = item.content;
        content = content.replace(regxRemoveNewline, "").split(" ");
        content = content.filter((item) => item);
        for (var i = 0; i < content.length; i++) {
          if (i !== 0 && i % 10 === 0) {
            content[i] = content[i] + "\n";
          }
        }
        content = content.join(" ");
        var fileName = `assets/${item.title
          .split(" ")
          .slice(0, 2)
          .join(" ")
          .replace(regexRemoveUnsupportFileName, "")}`;
        fs.writeFileSync(
          fileName + ".png",
          text2png(content, {
            color: "black",
            backgroundColor: "white",
            lineSpacing: 10,
            padding: 10,
          })
        );
        gtts = new gTTS(content, "en");
        gtts.save(fileName + ".mp3", function (err, result) {
          if (err) {
            throw new Error(err);
          }
          createVideo(fileName);
        });
      }
    });
    createFeedFile(feed.items);
  }
}
function getMP3DurationInSec(path) {
  return getMP3Duration(fs.readFileSync(path)) / 1000;
}
async function fetchRSS() {
  return await parser.parseURL("https://www.thehindu.com/feeder/default.rss");
}
function createFeedFile(items) {
  fs.writeFileSync("assets/feed.json", JSON.stringify(items));
}
async function storeLatestFeed() {
  let feed = await fetchRSS();
  createFeedFile(feed.items);
}
// setInterval(fetchAPI, 1500);

function createVideo(path) {
  var videoOptions = {
    fps: 25,
    loop: getMP3DurationInSec(path + ".mp3") + 2, // seconds
    transition: true,
    transitionDuration: 1, // seconds
    videoBitrate: 1024,
    videoCodec: "libx264",
    size: "640x?",
    audioBitrate: "128k",
    audioChannels: 2,
    format: "mp4",
    pixelFormat: "yuv420p",
  };

  videoshow([path + ".png"], videoOptions)
    .audio(path + ".mp3")
    .save(path + ".mp4")
    .on("start", function (command) {
      console.log("ffmpeg process started:", command);
    })
    .on("error", function (err, stdout, stderr) {
      console.error("Error:", err);
      console.error("ffmpeg stderr:", stderr);
    })
    .on("end", function (output) {
      console.error("Video created in:", output);
      fs.unlink(path + ".png", (err) => {
        if (err) throw err;
        console.log(`${path + ".png"} was deleted`);
      });
      fs.unlink(path + ".mp3", (err) => {
        if (err) throw err;
        console.log(`${path + ".mp3"} was deleted`);
      });
      // initializeYoutube(
      //   "test title",
      //   "test description",
      //   "test_tag",
      //   path + ".mp4"
      // );
    });
}
//initializeYoutube();
actConverion();
storeLatestFeed();
/* GET home page. */
router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});

module.exports = router;
