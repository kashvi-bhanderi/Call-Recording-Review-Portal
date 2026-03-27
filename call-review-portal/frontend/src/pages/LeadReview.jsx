import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import AudioPlayer from "../components/AudioPlayer";
import "./LeadReview.css";
import "./CallReview.css";
import DashboardHeader from "../components/DashboardHeader";
import StarRating from "../components/starrating";
import toast from "react-hot-toast";

const LeadReview = () => {
  const { uuid } = useParams();

  const [metadata, setMetadata] = useState({});
  const [consultant, setConsultant] = useState({});
  const [metrics, setMetrics] = useState([]);
  const [audioUrl, setAudioUrl] = useState("");

  const [leadComment, setLeadComment] = useState("");
  const [status, setStatus] = useState("");
  const [tags, setTags] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => {
    fetchCall();
  }, [uuid]);

  const fetchCall = async () => {
    try {
      const detailRes = await axiosInstance.get(`/calls/lead-detail/${uuid}/`);
      const data = detailRes.data;

      setMetadata(data.metadata || {});
      setConsultant(data.consultant_review || {});
      setMetrics(data.metrics || []);
      setLeadComment(data.lead_comment || "");
      setStatus(data.status ?? "");
      setTagOptions(data.tag_options || []);
      setTags(data.selected_tags || []);
      const alreadyReviewed = [3, 4].includes(data.status) && !!data.metadata?.reviewed_by;
      setIsSubmitted(alreadyReviewed);
      setIsEditing(false);

      try {
        const audioRes = await axiosInstance.get(`/calls/audio/${uuid}/`);
        setAudioUrl(audioRes.data.audio_url || "");
      } catch (audioErr) {
        console.warn("Audio fetch failed:", audioErr);
        setAudioUrl("");
      }
    } catch (err) {
      console.error("Failed to load lead review:", err);
      toast.error("Failed to load call details");
    }
  };

  const handleRatingChange = (name, value) => {
    setMetrics((prev) =>
      prev.map((m) => (m.name === name ? { ...m, value } : m))
    );
  };

  const submitReview = async () => {
    if (someMetricsFilled && !allMetricsFilled) {
      toast.error("Please rate all fields before submitting.");
      return;
    }
    try {
      if (!status) {
        toast.error("Please select status");
        return;
      }

      const ratings = {};

      metrics.forEach((m) => {
        if (m.value !== null && m.value !== "") {
          ratings[m.name] = Number(m.value);
        }
      });

      await axiosInstance.post("/calls/lead-rating/", {
        call_uuid: uuid,
        ratings,
        comment: leadComment,
        status: Number(status),
        tags: tags.map(Number),
      });

      toast.success(isEditing ? "Lead review updated successfully" : "Lead review submitted successfully");
      setIsSubmitted(true);
      setIsEditing(false);
      await fetchCall();

    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || "Failed to submit lead review";
      toast.error(msg);
      fetchCall();
    }
  };
  const isLocked = metadata.is_locked;
  const disableInputs = isLocked || (isSubmitted && !isEditing);
  const someMetricsFilled =
    metrics.length > 0 &&
    metrics.some((m) => m.value !== null && m.value !== "");

  const allMetricsFilled =
    metrics.length > 0 &&
    metrics.every((m) => m.value !== null && m.value !== "");
  return (
    <div className="review-page">
      <div className="review-container">
        <DashboardHeader title="Lead Dashboard" />

        {audioUrl ? (
          <AudioPlayer audioUrl={audioUrl} />
        ) : (
          <div className="audio-unavailable">Audio not available</div>
        )}

        <div className="review-body">
          {/* Metadata */}
          <div className="metadata">
            <h3>Call Metadata</h3>

            <p><b>Organization:</b> {metadata.org_name || metadata.schema_name || "-"}</p>
            <p><b>Language:</b> {metadata.language || "-"}</p>
            <p><b>UUID:</b> {metadata.uuid || "-"}</p>
            <p><b>Phone:</b> {metadata.phone_number || "-"}</p>
            <p><b>Date:</b> {metadata.attempt_on_time_stamp || "-"}</p>

            <p>
              <b>Duration:</b>{" "}
              {metadata.duration != null
                ? `${Math.floor(metadata.duration / 60)}m ${metadata.duration % 60}s`
                : "-"}
            </p>

            <p>
              <b>Status:</b>{" "}
              <span
                className={`status-badge status-${(metadata.status || "")
                  .toLowerCase()
                  .replace(/\s+/g, "")}`}
              >
                {metadata.status || "-"}
              </span>
            </p>

            {metadata.reviewed_by && (
              <p><b>Reviewed By:</b> {metadata.reviewed_by}</p>
            )}

            {metadata.is_locked && metadata.lock_message && (
              <p style={{ fontSize: "12px", color: "#dc2626", marginTop: "8px" }}>
                {metadata.lock_message}
              </p>
            )}
          </div>

          {/* Lead Rating Panel */}
          <div className="rating-panel">
            <h3>Lead Review</h3>

            {metrics.length === 0 ? (
              <p style={{ color: "#666" }}>No metrics available</p>
            ) : (
              metrics.map((m) => {
                const useStars = Number(m.max) <= 5;

                return (
                  <div key={m.name} className="metric">
                    <label>{m.name}</label>

                    {useStars ? (
                      <StarRating
                        value={m.value ?? 0}
                        min={Number(m.min) || 1}
                        max={Number(m.max) || 5}
                        disabled={disableInputs}
                        onChange={(val) => handleRatingChange(m.name, val)}
                      />
                    ) : (
                      <input
                        type="number"
                        min={m.min}
                        max={m.max}
                        value={m.value ?? ""}
                        disabled={disableInputs}
                        onChange={(e) => handleRatingChange(m.name, e.target.value)}
                      />
                    )}

                    <p
                      className="rating-range"
                      style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}
                    >
                      Allowed: {m.min} - {m.max}
                    </p>
                  </div>
                );
              })
            )}

            <textarea
              placeholder="Lead Comment"
              value={leadComment}
              disabled={disableInputs}
              onChange={(e) => setLeadComment(e.target.value)}
            />

            <select
              value={status === null || status === undefined ? "" : status}
              disabled={disableInputs}
              onChange={(e) => {
                const val = e.target.value;
                setStatus(val === "" ? "" : Number(val));
              }}
            >
              <option value="">Select Status</option>
              <option value={3}>Production Issue</option>
              <option value={4}>Approved</option>
            </select>

            <select
              multiple
              value={tags}
              disabled={disableInputs}
              onChange={(e) =>
                setTags([...e.target.selectedOptions].map((o) => Number(o.value)))
              }
            >
              {tagOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {!isSubmitted && !isLocked && (
              <button className="submit-btn" onClick={submitReview}>
                Submit
              </button>
            )}

            {isSubmitted && !isLocked && !isEditing && (
              <button className="edit-btn" onClick={() => setIsEditing(true)}>
                Edit
              </button>
            )}

            {isSubmitted && !isLocked && isEditing && (
              <button className="submit-btn" onClick={submitReview}>
                Update
              </button>
            )}
          </div>

          {/* Consultant Review */}
          <div className="rating-panel">
            <h3>Consultant Review</h3>

            {consultant.ratings?.length > 0 ? (
              consultant.ratings.map((r, i) => (
                <div key={i} className="metric">
                  <label>{r.metric}</label>

                  <StarRating
                    value={r.value ?? 0}
                    min={1}
                    max={5}
                    disabled={true}
                    readOnly={true}
                  />
                </div>
              ))
            ) : (
              <p style={{ color: "#666" }}>No consultant review available</p>
            )}

            <textarea value={consultant.comment || ""} readOnly />

            <p>Submitted: {consultant.timestamp || "-"}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadReview;