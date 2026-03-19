import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import AudioPlayer from "../components/AudioPlayer";
import "./LeadReview.css";
import "./CallReview.css";
import DashboardHeader from "../components/DashboardHeader";
import StarRating from "../components/starrating";

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
      const [detailRes, audioRes] = await Promise.all([
        axiosInstance.get(`/calls/lead-detail/${uuid}/`),
        axiosInstance.get(`/calls/audio/${uuid}/`),
      ]);

      setMetadata(detailRes.data.metadata || {});
      setConsultant(detailRes.data.consultant_review || {});
      setMetrics(detailRes.data.metrics || []);
      setAudioUrl(audioRes.data.audio_url || "");

      setLeadComment(detailRes.data.lead_comment || "");
      setStatus(detailRes.data.status ?? "");

      setTagOptions(detailRes.data.tag_options || []);
      setTags(detailRes.data.selected_tags || []);

      const statusFinalized = ["Need Fix", "Approved"].includes(
        detailRes.data.metadata?.status
      );

      if (statusFinalized) {
        setIsSubmitted(true);
        setIsEditing(false);
      } else {
        const rated = (detailRes.data.metrics || []).some(
          (m) => m.value !== null && m.value !== ""
        );
        setIsSubmitted(rated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRatingChange = (name, value) => {
    setMetrics((prev) =>
      prev.map((m) => (m.name === name ? { ...m, value } : m))
    );
  };

  const submitReview = async () => {
    try {
      if (!status) {
        alert("Please select status");
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

      alert(isEditing ? "Lead Review Updated" : "Lead Review Submitted");

      setIsSubmitted(true);
      setIsEditing(false);

      await fetchCall();
    } catch (err) {
      console.error(err);
      alert("Failed to submit lead review");
    }
  };

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

            <p><b>Schema:</b> {metadata.schema_name || "-"}</p>
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
          </div>

          {/* Lead Rating Panel */}
          <div className="rating-panel">
            <h3>Lead Review</h3>

            {metrics.length === 0 ? (
              <p style={{ color: "#666" }}>No metrics available</p>
            ) : (
              metrics.map((m, i) => {
                const useStars = Number(m.max) <= 5;

                return (
                  <div key={i} className="metric">
                    <label>{m.name}</label>

                    {useStars ? (
                      <StarRating
                        value={m.value ?? 0}
                        min={Number(m.min) || 1}
                        max={Number(m.max) || 5}
                        disabled={isSubmitted && !isEditing}
                        onChange={(val) => handleRatingChange(m.name, val)}
                      />
                    ) : (
                      <input
                        type="number"
                        min={m.min}
                        max={m.max}
                        value={m.value ?? ""}
                        disabled={isSubmitted && !isEditing}
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
              disabled={isSubmitted && !isEditing}
              onChange={(e) => setLeadComment(e.target.value)}
            />

            <select
              value={status === null || status === undefined ? "" : status}
              disabled={isSubmitted && !isEditing}
              onChange={(e) => {
                const val = e.target.value;
                setStatus(val === "" ? "" : Number(val));
              }}
            >
              <option value="">Select Status</option>
              <option value={3}>Need Fix</option>
              <option value={4}>Approved</option>
            </select>

            <select
              multiple
              value={tags}
              disabled={isSubmitted && !isEditing}
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

            {!isSubmitted && (
              <button className="submit-btn" onClick={submitReview}>
                Submit
              </button>
            )}

            {isSubmitted && !isEditing && (
              <button className="edit-btn" onClick={() => setIsEditing(true)}>
                Edit
              </button>
            )}

            {isEditing && (
              <button className="submit-btn" onClick={submitReview}>
                Update
              </button>
            )}
          </div>

          {/* Consultant Review */}
          <div className="rating-panel">
            <h3>Consultant Review</h3>

            {consultant.ratings?.length > 0 ? (
              consultant.ratings.map((r, i) => {
                const useStars = Number(r.max || 5) <= 5;

                return (
                  <div key={i} className="metric">
                    <label>{r.metric}</label>

                    {useStars ? (
                      <StarRating
                        value={r.value ?? 0}
                        min={Number(r.min) || 1}
                        max={Number(r.max) || 5}
                        disabled={true}
                        readOnly={true}
                      />
                    ) : (
                      <input value={r.value ?? ""} readOnly />
                    )}
                  </div>
                );
              })
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