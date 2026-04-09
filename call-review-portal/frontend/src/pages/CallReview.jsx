import React, { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import AudioPlayer from "../components/AudioPlayer";
import DashboardHeader from "../components/DashboardHeader";
import StarRating from "../components/starrating";
import "./CallReview.css";
import "./LeadReview.css"; // reusing transcript styles
import toast from "react-hot-toast";

const CallReview = () => {
  const { uuid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [metadata, setMetadata] = useState({});
  const [metrics, setMetrics] = useState([]);
  const [comments, setComments] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [leadMetrics, setLeadMetrics] = useState([]);
  const [leadComment, setLeadComment] = useState("");

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditable, setIsEditable] = useState(true);
  const [lockMessage, setLockMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchCall = useCallback(async () => {
    setLoading(true);

    try {
      const detailRes = await axiosInstance.get(`/calls/detail/${uuid}/`);
      const data = detailRes.data;

      setMetadata(data.metadata || {});
      setMetrics(data.metrics || []);
      setComments(data.comments || "");
      setLeadMetrics(data.lead_metrics || []);
      setLeadComment(data.lead_comment || "");

      const rated = (data.metrics || []).some(
        (m) => m.value !== null && m.value !== ""
      );

      if (data.is_locked) {
        setIsEditable(false);
        setIsEditing(false);
        setIsSubmitted(rated);

        if (data.lock_reason === "permanent") {
          setLockMessage("Lead reviewed this call. You cannot update it.");
        } else if (data.lock_reason === "temporary") {
          setLockMessage("Lead is reviewing this call. Editing temporarily disabled.");
        } else if (data.lock_reason === "consultant_taken") {
          setLockMessage("Another consultant already rated this call.");
        } else {
          setLockMessage("This call is locked.");
        }
      } else {
        setIsEditable(true);
        setLockMessage("");
        setIsSubmitted(rated);
      }

      try {
        const audioRes = await axiosInstance.get(`/calls/audio/${uuid}/`);
        setAudioUrl(audioRes.data.audio_url || "");
      } catch (audioErr) {
        console.warn("Audio fetch failed:", audioErr);
        setAudioUrl("");
      }
      try {
        setTranscriptLoading(true);
        const transcriptRes = await axiosInstance.get(`/calls/transcript/${uuid}/`);
        setTranscript(transcriptRes.data?.transcript || []);
      } catch (transcriptErr) {
        console.warn("Transcript fetch failed:", transcriptErr);
        setTranscript([]);
      } finally {
        setTranscriptLoading(false);
      }
    } catch (err) {
      console.error("Call detail fetch failed:", err);
      toast.error("Failed to load call details");
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => {
    fetchCall();
  }, [fetchCall]);

  const handleRatingChange = (name, value) => {
    setMetrics((prev) =>
      prev.map((m) => (m.name === name ? { ...m, value } : m))
    );
  };

  const allMetricsFilled =
    metrics.length > 0 &&
    metrics.every((m) => m.value !== null && m.value !== "");

  const submitReview = async () => {
    if (!allMetricsFilled) {
      toast.error("Please rate all fields before submitting.");
      return;
    }

    try {
      const ratings = {};

      metrics.forEach((m) => {
        if (m.value !== null && m.value !== "") {
          ratings[m.name] = Number(m.value);
        }
      });

      await axiosInstance.post("/calls/consultant-rating/", {
        call_uuid: uuid,
        ratings,
        comments,
      });

      toast.success(
        isEditing ? "Review updated successfully" : "Review submitted successfully"
      );

      setIsSubmitted(true);
      setIsEditing(false);

      await fetchCall();
    } catch (err) {
      console.error("Submit failed:", err);
      const msg = err.response?.data?.error || "Failed to submit review";
      toast.error(msg);
      fetchCall();
    }
  };

  const handleBackToDashboard = () => {
    // Best UX: if user came from dashboard, go back in history
    if (location.state?.fromDashboard) {
      navigate(-1);
      return;
    }

    // fallback for direct open / refresh
    navigate("/consultant/dashboard");
  };

  const disableInputs = !isEditable || (isSubmitted && !isEditing);

  return (
    <div className="review-page">
      <div className="review-container">
        <DashboardHeader title="Consultant Dashboard" />

        {loading ? (
          <p>Loading call details...</p>
        ) : (
          <>
            {audioUrl ? (
              <AudioPlayer audioUrl={audioUrl} />
            ) : (
              <div className="audio-unavailable">Audio not available</div>
            )}


            <div className="transcript-section">
              <h3>Call Transcript</h3>

              {transcriptLoading ? (
                <p>Loading transcript...</p>
              ) : transcript.length > 0 ? (
                <div className="transcript-table-wrapper">
                  <div className="transcript-header-row">
                    <div className="transcript-col turn-col">Turn</div>
                    <div className="transcript-col user-col">User</div>
                    <div className="transcript-col agent-col">Agent</div>
                  </div>

                  <div className="transcript-body">
                    {transcript.map((row, index) => (
                      <div
                        key={`${row.uuid}-${row.round}-${index}`}
                        className="transcript-data-row"
                      >
                        <div className="transcript-col turn-col turn-badge">
                          {row.round || index + 1}
                        </div>

                        <div className="transcript-col transcript-cell user-cell">
                          {row.stt_output && row.stt_output.trim() ? row.stt_output : "-"}
                        </div>

                        <div className="transcript-col transcript-cell agent-cell">
                          {row.tts_input && row.tts_input.trim() ? row.tts_input : "-"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="transcript-empty">No transcript available</p>
              )}
            </div>

            <div className="review-body"></div>
            <div className="review-body">
              {/* Metadata */}
              <div className="metadata">
                <h3>Call Metadata</h3>

                <p>
                  <b>Organization:</b> {metadata.org_name || metadata.schema_name || "-"}
                </p>
                <p>
                  <b>Language:</b> {metadata.language || "-"}
                </p>
                <p>
                  <b>UUID:</b> {metadata.uuid || "-"}
                </p>
                <p>
                  <b>Mobile:</b> {metadata.phone_number || "-"}
                </p>
                <p>
                  <b>Date:</b>{" "}
                  {metadata.attempt_on_time_stamp
                    ? new Date(metadata.attempt_on_time_stamp).toLocaleString()
                    : "-"}
                </p>
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

                {metadata.rated_by && (
                  <p>
                    <b>Rated By:</b> {metadata.rated_by}
                  </p>
                )}
              </div>

              {/* Consultant Review */}
              <div className="rating-panel">
                <h3>Consultant Review</h3>

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
                            onChange={(e) =>
                              handleRatingChange(m.name, e.target.value)
                            }
                          />
                        )}

                        <p
                          className="rating-range"
                          style={{
                            fontSize: "11px",
                            color: "#666",
                            marginTop: "2px",
                          }}
                        >
                          Allowed: {m.min} - {m.max}
                        </p>
                      </div>
                    );
                  })
                )}

                <textarea
                  placeholder="Comments"
                  value={comments}
                  disabled={disableInputs}
                  onChange={(e) => setComments(e.target.value)}
                />

                {!isSubmitted && isEditable && (
                  <button className="submit-btn" onClick={submitReview}>
                    Submit
                  </button>
                )}

                {isSubmitted && isEditable && !isEditing && (
                  <button className="edit-btn" onClick={() => setIsEditing(true)}>
                    Edit
                  </button>
                )}

                {isEditing && isEditable && (
                  <button className="submit-btn" onClick={submitReview}>
                    Update
                  </button>
                )}

                {!isEditable && (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#dc2626",
                      marginTop: "8px",
                    }}
                  >
                    {lockMessage}
                  </p>
                )}
              </div>

              {/* Lead Final Review */}
              {leadMetrics.length > 0 && (
                <div className="rating-panel">
                  <h3>Lead Final Review</h3>

                  {leadMetrics.map((m) => {
                    const useStars = Number(m.max) <= 5;

                    return (
                      <div key={m.name} className="metric">
                        <label>{m.name}</label>

                        {useStars ? (
                          <StarRating
                            value={m.value ?? 0}
                            min={Number(m.min) || 1}
                            max={Number(m.max) || 5}
                            disabled={true}
                            readOnly={true}
                          />
                        ) : (
                          <input
                            type="number"
                            min={m.min}
                            max={m.max}
                            value={m.value ?? ""}
                            disabled={true}
                            readOnly
                          />
                        )}

                        <p
                          className="rating-range"
                          style={{
                            fontSize: "11px",
                            color: "#666",
                            marginTop: "2px",
                          }}
                        >
                          Allowed: {m.min} - {m.max}
                        </p>
                      </div>
                    );
                  })}

                  <textarea
                    placeholder="Lead Comment"
                    value={leadComment}
                    disabled={true}
                    readOnly
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CallReview;