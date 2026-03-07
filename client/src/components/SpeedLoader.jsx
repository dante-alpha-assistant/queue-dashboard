import './SpeedLoader.css';

export default function SpeedLoader({ label = "Loading tasks..." }) {
  return (
    <div className="speed-loader-wrapper">
      <div className="longfazers">
        <span></span>
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className="speed-loader-container">
        <div className="speeder">
          <span className="strmark"></span>
          <span className="strmark"></span>
          <span className="strmark"></span>
          <span className="strmark"></span>
          <div className="head"></div>
          <div className="body">
            <div className="inner"></div>
          </div>
        </div>
        <div className="speed-loader-progress">
          <div className="fill"></div>
        </div>
        <div className="speed-loader-label">{label}</div>
      </div>
    </div>
  );
}
