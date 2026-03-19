import React from "react";
import "./starrating.css";
const StarRating = ({
  value = 0,
  min = 1,
  max = 5,
  onChange = () => {},
  disabled = false,
  readOnly = false,
}) => {
  const totalStars = max <= 5 ? max : 5;
  const numericValue = Number(value) || 0;

  return (
    <div className="star-rating">
      {Array.from({ length: totalStars }, (_, i) => {
        const starValue = i + 1;
        const filled = starValue <= numericValue;

        return (
          <span
            key={starValue}
            className={`star ${filled ? "filled" : ""} ${
              disabled || readOnly ? "readonly" : ""
            }`}
            onClick={() => {
              if (!disabled && !readOnly) {
                onChange(Math.max(min, starValue));
              }
            }}
          >
            ★
          </span>
        );
      })}
    </div>
  );
};

export default StarRating;