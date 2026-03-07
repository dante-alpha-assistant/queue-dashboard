import React from "react";
import "./SpeedLoader.css";

export default function SpeedLoader({ text = "Loading tasks..." }) {
  return (
    <div className="speed-loader-wrapper">
      <div className="speed-loader-container">
        {/* Speed-loader character */}
        <div className="speeder">
          <div className="strmark">
            <div className="dot dot-1" />
            <div className="dot dot-2" />
            <div className="dot dot-3" />
            <div className="dot dot-4" />
          </div>
          <div className="body">
            <div className="eye" />
          </div>
          <div className="speed-line speed-line-1" />
          <div className="speed-line speed-line-2" />
          <div className="speed-line speed-line-3" />
          <div className="speed-line speed-line-4" />
        </div>

        {/* Long fazer background lines */}
        <div className="longfazer">
          <span className="lf lf-1" />
          <span className="lf lf-2" />
          <span className="lf lf-3" />
          <span className="lf lf-4" />
        </div>

        {/* Loading text and progress bar */}
        <div className="speed-loader-text">{text}</div>
        <div className="speed-loader-progress">
          <div className="speed-loader-progress-bar" />
        </div>
      </div>
    </div>
  );
}
