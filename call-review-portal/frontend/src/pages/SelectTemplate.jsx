import React, { useEffect, useState } from "react";
import axiosInstance from "../api/axiosInstance";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import "./Login.css";

const SelectTemplate = ({ role }) => {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const selectedOrg = localStorage.getItem("selectedOrg");

  useEffect(() => {
    if (!selectedOrg) {
      toast.error("Please select organization first");
      if (role === "consultant") {
        navigate("/consultant/select-organization");
      } else {
        navigate("/lead/select-organization");
      }
      return;
    }

    fetchTemplates();
    // eslint-disable-next-line
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/calls/selectable-templates/", {
        params: { schema_name: selectedOrg },
      });

      setTemplates(res.data.templates || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedTemplate) {
      toast.error("Please select template");
      return;
    }

    localStorage.setItem("selectedTemplate", selectedTemplate);

    if (role === "consultant") {
      navigate("/consultant");
    } else {
      navigate("/lead");
    }
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h2>Select Template</h2>

        {loading ? (
          <p>Loading templates...</p>
        ) : (
          <>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                marginBottom: "16px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
              }}
            >
              <option value="">Select Template</option>
              {templates.map((template) => (
                <option key={template.template_id} value={template.template_id}>
                  {template.template_name
                    ? `${template.template_name} (${template.template_id})`
                    : template.template_id}
                </option>
              ))}
            </select>

            <button onClick={handleContinue}>Open Dashboard</button>
          </>
        )}
      </div>
    </div>
  );
};

export default SelectTemplate;