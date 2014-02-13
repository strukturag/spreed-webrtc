#!/bin/bash

sox -v .4  sprite1.wav .tmp-sprite1.wav

avconv -y -i .tmp-sprite1.wav -aq 2 -acodec libmp3lame sprite1.mp3
avconv -y -i .tmp-sprite1.wav -aq 2 -acodec libvorbis sprite1.ogg

rm -f .tmp-sprite1.wav

cp -fv sprite1.{mp3,ogg} ../../static/sounds
