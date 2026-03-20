import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import "./MiniAudioPlayer.css";

const MiniAudioPlayer = ({ src }) => {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!src || !waveformRef.current) return;

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
      height: 36,
      normalize: true,
      interact: true,
    });

    wavesurferRef.current = ws;
    ws.load(src);

    ws.on("ready", () => {
      setIsReady(true);
      setDuration(ws.getDuration());
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
  }, [src]);

  const togglePlayPause = () => {
    if (!wavesurferRef.current || !isReady) return;
    wavesurferRef.current.playPause();
  };

  const formatTime = (sec) => {
    if (!sec || isNaN(sec)) return "0:00";
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="mini-audio-player">
      <button
        className="mini-audio-btn"
        onClick={togglePlayPause}
        disabled={!isReady}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      <div className="mini-waveform-wrapper">
        {!src ? (
          <span className="mini-audio-loading">Loading...</span>
        ) : (
          <div ref={waveformRef} className="mini-waveform" />
        )}
      </div>

      <div className="mini-time-box">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>
    </div>
  );
};

export default MiniAudioPlayer;