import React, { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import backIcon from "../../assets/back.svg";

const apiUrl = import.meta.env.VITE_API_URL;

const PollHistoryPage = () => {
  const [polls, setPolls] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const getPolls = async () => {
      let username = sessionStorage.getItem("username");

      if (!username) {
        console.warn("❌ No username found in sessionStorage.");
        return;
      }

      // Optional: normalize to lowercase
      username = username.toLowerCase();

      try {
        const response = await axios.get(`${apiUrl}/polls/${username}`);
        console.log("✅ Polls fetched:", response.data);
        setPolls(response.data?.data || []);
      } catch (error) {
        console.error("❌ Error fetching polls:", error.response?.data || error.message);
        setPolls([]);
      }
    };

    getPolls();
  }, []);

  const calculatePercentage = (count, totalVotes) => {
    if (totalVotes === 0) return 0;
    return (count / totalVotes) * 100;
  };

  const handleBack = () => {
    navigate("/teacher-home-page");
  };

  return (
    <div className="container mt-5 w-50">
      <div className="mb-4 text-left">
        <img
          src={backIcon}
          alt="Back"
          width="25px"
          style={{ cursor: "pointer" }}
          onClick={handleBack}
        />{" "}
        View <b>Poll History</b>
      </div>

      {polls.length > 0 ? (
        polls.map((poll, index) => {
          const totalVotes = poll.Options?.reduce(
            (sum, option) => sum + (option?.votes || 0),
            0
          );

          return (
            <div key={poll.id || index}>
              <div className="pb-3">{`Question ${index + 1}`}</div>
              <div className="card mb-4">
                <div className="card-body">
                  <h6 className="question py-2 ps-2 text-left rounded text-white bg-primary">
                    {poll.question}
                  </h6>
                  <div className="list-group mt-4">
                    {poll.Options?.map((option) => (
                      <div key={option.id} className="list-group-item rounded m-2">
                        <div className="d-flex justify-content-between align-items-center">
                          <span>{option.text}</span>
                          <span>
                            {Math.round(calculatePercentage(option.votes, totalVotes))}%
                          </span>
                        </div>
                        <div className="progress mt-2">
                          <div
                            className="progress-bar"
                            role="progressbar"
                            style={{
                              width: `${calculatePercentage(option.votes, totalVotes)}%`,
                            }}
                            aria-valuenow={option.votes}
                            aria-valuemin="0"
                            aria-valuemax="100"
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-muted">No polls found.</div>
      )}
    </div>
  );
};

export default PollHistoryPage;
