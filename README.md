# Video-Sharing-Platform

This is a video sharing platform. Capable of sharing videos (video on-demand) and live streaming to mass audiance.

**NOTE:** This project is not completed and absolutely not production ready.

## Download

Use git to clone the project

## Usage

```bash
npm install
npm start
```

## Details

This project is capable of video sharing (video on-demand).
Newly uploaded videos have to be transcoded to HLS packaging.
In this process the video and subtitles uploaded by users will be packaged to HLS packaging using [FFMPEG](https://www.ffmpeg.org/). This will produce output of multiple versions of the same video. like different codecs, resolutions, bitrates and etc.
Live streaming is handled by [Nginx](https://nginx.org/) and a module called [nginx-rtmp-module](https://github.com/arut/nginx-rtmp-module), but it is controlled and secured by this project.
One user can have many channels, and one channel can have many videos and lives.
But only users can comment not channels.
There is oAuth2.0 functionality and 2FA functionality for your emails.

### Commands

There are two commands of ffmpeg used in this project to achive hls packaging.
The first one is a command that runs first and takes the video as input and outputs 3 variants of the video with associated m3u8 files and one final master m3u8.
Each variant is in different quality and resolution to give the player of user adaptive bitrate streaming.

```bash
ffmpeg -loglevel error -y -i ../input.mp4 \
-filter_complex \
"[0:v]fps=fps=30,split=3[v1][v2][v3]; \
[v1]scale=width=-2:height=1080[1080p]; [v2]scale=width=-2:height=720[720p]; [v3]scale=width=-2:height=360[360p]" \
-codec:v libx264 -crf:v 23 -profile:v high -pix_fmt:v yuv420p -rc-lookahead:v 60 -force_key_frames:v expr:'gte(t,n_forced*2.000)' -preset:v "medium" -b-pyramid:v "strict"  \
-map [1080p] -maxrate:v:0 2000000 -bufsize:v:0 2*2000000 -level:v:0 4.0 \
-map [720p] -maxrate:v:1 1200000 -bufsize:v:1 2*1000000 -level:v:1 3.1 \
-map [360p] -maxrate:v:2 700000 -bufsize:v:2 2*500000 -level:v:2 3.1 \
-codec:a aac -ac:a 2 \
-map 0:a:0 -b:a:0 192000 \
-map 0:a:0 -b:a:1 128000 \
-map 0:a:0 -b:a:2 96000 \
-f hls \
-hls_flags +independent_segments+program_date_time+single_file \
-hls_time 6 \
-hls_playlist_type vod \
-hls_segment_type mpegts \
-master_pl_name 'master.m3u8' \
-var_stream_map \'v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:360p\' \
-hls_segment_filename 'segment_%v_%05d.ts' 'manifest_%v.m3u8'
```

This command resizes the 1080p video that was uploaded to 1080p, 720p and 360p. For each variant a suitable (low size file with acceptable quality) bitrate is chosen. It is possible to change it, nothing will break. H.264 codec (libx264 encode) was chosen for video codec, in new versions of HLS you can use H.265 if you want. AAC codec was chosen for audio.
And with help of `single_file` the segmentation is done through byterange instead of actual seperate segments.

The second command is used after the first one whenever a new subtitle is uploaded.

```bash
ffmpeg -loglevel error -y -i input.ts -i ../sub1.srt \
-c:v copy \
-c:s webvtt \
-map 0:v \
-map 1:s \
-shortest \
-f hls \
-hls_flags +independent_segments+program_date_time+single_file \
-hls_time 6 \
-hls_playlist_type vod \
-hls_subtitle_path sub_eng.m3u8 \
-hls_segment_type mpegts \
-var_stream_map 'v:0,s:0,name:Spanish,sgroup:subtitle' \
-hls_segment_filename 'redundant_%v.ts' sub_%v.m3u8
```

`sgroup` is a new feature impelemented in ffmpeg to integrate subtitles into hls packaging. but beacause this feature is new, it does not have good functionality, therefore we use this feature only to process and segment the subtitle and the associated m3u8 (in this process the video is used as heartbeat for segmentation, turns out without the heartbeat the segmentation won't be perfect ). But we add the tag for this subtitle to master file manully with this package: (m3u8-parser)[https://github.com/miadabdi/m3u8-parser]

One other downside to this approch is, using the video as heartbeat will produce redundant extra identical-to-input videos, which we do not need. All of names of these redundant videos start with `redundant` so it would be easy to delete them afterwards.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html)
