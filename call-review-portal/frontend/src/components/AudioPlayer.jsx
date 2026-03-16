import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import "./AudioPlayer.css";

const AudioPlayer = ({ audioUrl }) => {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!audioUrl || !waveformRef.current) return;

    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#d1d5db",
      progressColor: "#2563eb",
      cursorColor: "#111827",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 90,
      normalize: true,
      interact: true,
    });

    wavesurferRef.current = ws;

    ws.load(audioUrl);

    ws.on("ready", () => {
      setIsReady(true);
      setDuration(ws.getDuration());
      ws.setVolume(volume);
      ws.setPlaybackRate(speed);
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => {
      setIsPlaying(false);
      setCurrentTime(ws.getDuration());
    });

    ws.on("audioprocess", () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on("seek", () => {
      setCurrentTime(ws.getCurrentTime());
    });

    return () => {
      ws.destroy();
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    if (!wavesurferRef.current || !isReady) return;
    wavesurferRef.current.playPause();
  };

  const handleSeek = (e) => {
    if (!wavesurferRef.current || !isReady) return;

    const value = Number(e.target.value);
    const progress = duration ? value / duration : 0;
    wavesurferRef.current.seekTo(progress);
    setCurrentTime(value);
  };

  const handleVolumeChange = (e) => {
    const val = Number(e.target.value);
    setVolume(val);

    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(val);
    }
  };

  const handleSpeedChange = (e) => {
    const val = Number(e.target.value);
    setSpeed(val);

    if (wavesurferRef.current) {
      wavesurferRef.current.setPlaybackRate(val);
    }
  };

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return "0:00";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="audio-player-container">
      <div className="waveform-box">
        {!audioUrl ? <p>Loading audio...</p> : <div ref={waveformRef} />}
      </div>

      <div className="audio-controls">
        <button
          className="audio-btn"
          onClick={togglePlayPause}
          disabled={!isReady}
        >
          {isPlaying ? "Pause" : "Play"}
        </button>

        <div className="time-box">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <input
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={currentTime}
          onChange={handleSeek}
          disabled={!isReady}
          className="seek-bar"
        />

        <div className="volume-box">
          <label>Vol</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolumeChange}
          />
        </div>

        <div className="speed-box">
          <label>Speed</label>
          <select value={speed} onChange={handleSpeedChange}>
            <option value="0.5">0.5x</option>
            <option value="0.75">0.75x</option>
            <option value="1">1x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2x</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;