# Video-Sharing-Platform

This is a video sharing platform. Capable of sharing videos (video on-demand) and live streaming to mass audiance.

**NOTE:** This project is not completed and absolutely not production ready.

## Download

Use git to clone the project

## Usage

```bash
# npm install
# npm start
```
## Details

This project is capable of video sharing (video on-demand).
Newly uploaded videos have to be transcoded to HLS packaging.
In this process the video and subtitles uploaded by users will be packaged to HLS packaging using [FFMPEG](https://www.ffmpeg.org/). This will produce output of multiple versions of the same video. like different codecs, resolutions, bitrates and etc.
Live streaming is handled by [Nginx](https://nginx.org/) and a module called [nginx-rtmp-module](https://github.com/arut/nginx-rtmp-module), but it is controlled and secured by this project.
One user can have many channels, and one channel can have many videos and lives.
But only users can comment not channels.
There is oAuth2.0 functionality and 2FA functionality for your emails.


## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License
[GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.html)