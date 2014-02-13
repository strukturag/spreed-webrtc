#!/usr/bin/python

import wave
import os
import glob
import json
import math

silenceDuration = 0.05  # Seconds of silence between merged files
outfile = "sprite1.wav"  # Output file. Will be saved in the path below.

def main(folder="./files"):

    currentTime = 0
    sprite = {}

    # Open output file
    output = wave.open(outfile, 'wb')
    
    # Loop through files in folder and append to outfile
    for i, infile in enumerate(glob.glob(os.path.join(folder, '*.wav'))):
    
        # Open file and get info
        w = wave.open(infile, 'rb')
        soundDuration = w.getnframes() / float(w.getframerate())

        # First file: determine general parameters- Create silence.
        if i == 0:
            print "params", w.getparams()
            output.setparams(w.getparams())
            silenceData = [0] * int(w.getframerate() * 2 * silenceDuration)  # N 0's where N are the number of samples corresponding to the duration specified in "silenceDuration"
            silenceFrames = "".join(wave.struct.pack('h', item) for item in silenceData)

        # Output sound + silence to file
        output.writeframes(w.readframes(w.getnframes()))
        output.writeframes(silenceFrames)
        w.close()

        # Create sprite data for Howler
        start = int(math.floor(currentTime * 1000))
        duration = int(math.ceil((soundDuration) * 1000))
        sprite[os.path.basename(infile[:-4])] = [start, duration]
        print "infile", infile, start, duration
        currentTime += (soundDuration + silenceDuration)

    # Yay, the worst is behind us. Close output file
    output.close()

    # Output howler sprite data
    print json.dumps(sprite, sort_keys=True, indent=4, separators=(',', ': '))
        
if __name__ == "__main__":
    main()
