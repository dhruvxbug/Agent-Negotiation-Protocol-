// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentRegistry {

    struct Agent {
        address wallet;
        string name;
        string serviceNiche;
        uint256 reputationScore;
        uint256 totalRatings;
        uint256 dealsCompleted;
        uint256 dealsAbandoned;
        uint256 totalEarnedWei;
        uint256 registeredAt;
        bool isActive;
    }

    struct DealFeedback {
        bytes32 sessionId;
        address rater;
        address rated;
        uint8 score;
        bool deliveredOnTime;
        uint256 timestamp;
    }

    mapping(address => Agent) public agents;
    mapping(address => bool) public isRegistered;
    mapping(bytes32 => DealFeedback[]) public sessionFeedback;
    mapping(bytes32 => mapping(address => bool)) public feedbackGiven;
    address[] public agentIndex;

    event AgentRegistered(address indexed wallet, string name, string niche);
    event FeedbackSubmitted(bytes32 indexed sessionId, address indexed rated, uint8 score);
    event ReputationUpdated(address indexed agent, uint256 oldScore, uint256 newScore);
    event DealStatsUpdated(address indexed agent, uint256 dealsCompleted, uint256 totalEarned);
    event DealAbandoned(address indexed agent, uint256 oldScore, uint256 newScore);

    modifier onlyRegistered() {
        require(isRegistered[msg.sender], "Agent not registered");
        _;
    }

    function registerAgent(string calldata name, string calldata niche) external {
        require(!isRegistered[msg.sender], "Already registered");
        require(bytes(name).length > 0 && bytes(name).length <= 64, "Invalid name");
        require(bytes(niche).length > 0 && bytes(niche).length <= 32, "Invalid niche");

        agents[msg.sender] = Agent({
            wallet: msg.sender,
            name: name,
            serviceNiche: niche,
            reputationScore: 5000,
            totalRatings: 0,
            dealsCompleted: 0,
            dealsAbandoned: 0,
            totalEarnedWei: 0,
            registeredAt: block.timestamp,
            isActive: true
        });

        isRegistered[msg.sender] = true;
        agentIndex.push(msg.sender);

        emit AgentRegistered(msg.sender, name, niche);
    }

    function submitFeedback(
        bytes32 sessionId,
        address rated,
        uint8 score,
        bool deliveredOnTime
    ) external onlyRegistered {
        require(isRegistered[rated], "Rated agent not registered");
        require(score >= 1 && score <= 5, "Score must be 1-5");
        require(msg.sender != rated, "Cannot rate yourself");
        require(!feedbackGiven[sessionId][msg.sender], "Already rated this session");

        feedbackGiven[sessionId][msg.sender] = true;

        DealFeedback memory fb = DealFeedback({
            sessionId: sessionId,
            rater: msg.sender,
            rated: rated,
            score: score,
            deliveredOnTime: deliveredOnTime,
            timestamp: block.timestamp
        });

        sessionFeedback[sessionId].push(fb);

        Agent storage agent = agents[rated];
        uint256 oldScore = agent.reputationScore;
        uint256 newRatingBps = uint256(score) * 2000;

        uint256 newScore = (agent.reputationScore * 80 + newRatingBps * 20) / 100;
        agent.reputationScore = newScore;
        agent.totalRatings += 1;

        emit FeedbackSubmitted(sessionId, rated, score);
        emit ReputationUpdated(rated, oldScore, newScore);
    }

    function recordDealCompleted(address agent, uint256 earnedWei) external onlyRegistered {
        require(isRegistered[agent], "Agent not registered");
        agents[agent].dealsCompleted += 1;
        agents[agent].totalEarnedWei += earnedWei;
        emit DealStatsUpdated(agent, agents[agent].dealsCompleted, agents[agent].totalEarnedWei);
    }

    function recordDealAbandoned(address agent) external onlyRegistered {
        require(isRegistered[agent], "Agent not registered");
        uint256 oldScore = agents[agent].reputationScore;
        agents[agent].dealsAbandoned += 1;
        if (agents[agent].reputationScore > 100) {
            agents[agent].reputationScore -= 100;
        }
        emit DealAbandoned(agent, oldScore, agents[agent].reputationScore);
    }

    function getReputationScore(address agent) external view returns (uint256) {
        return agents[agent].reputationScore;
    }

    function getAgent(address wallet) external view returns (Agent memory) {
        return agents[wallet];
    }

    function getAgentsByNiche(string calldata niche, uint256 limit)
        external view returns (address[] memory)
    {
        uint256 count = 0;
        for (uint i = 0; i < agentIndex.length; i++) {
            if (keccak256(bytes(agents[agentIndex[i]].serviceNiche)) == keccak256(bytes(niche))
                && agents[agentIndex[i]].isActive) {
                count++;
            }
        }

        uint256 returnCount = count < limit ? count : limit;
        address[] memory result = new address[](returnCount);
        uint256 idx = 0;

        for (uint i = 0; i < agentIndex.length && idx < returnCount; i++) {
            if (keccak256(bytes(agents[agentIndex[i]].serviceNiche)) == keccak256(bytes(niche))
                && agents[agentIndex[i]].isActive) {
                result[idx] = agentIndex[i];
                idx++;
            }
        }

        return result;
    }

    function getTotalAgents() external view returns (uint256) {
        return agentIndex.length;
    }
}
