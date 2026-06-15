// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NegotiationEngine {

    enum SessionStatus { OPEN, ACTIVE, AGREED, EXPIRED, CANCELLED }

    struct Session {
        bytes32 sessionId;
        address buyer;
        address seller;
        string serviceDescription;
        uint256 buyerBudgetCap;
        uint256 currentRound;
        uint256 maxRounds;
        uint256 agreedPrice;
        uint256 deadline;
        SessionStatus status;
        uint256[] buyerOffers;
        uint256[] sellerOffers;
    }

    mapping(bytes32 => Session) public sessions;
    bytes32[] public sessionIds;
    mapping(address => bytes32[]) public buyerSessions;
    mapping(address => bytes32[]) public sellerSessions;

    event SessionOpened(bytes32 indexed sessionId, address indexed buyer, address indexed seller, string serviceDescription);
    event SellerJoined(bytes32 indexed sessionId, address indexed seller);
    event OfferSubmitted(bytes32 indexed sessionId, uint256 round, string role, uint256 amount);
    event DealReached(bytes32 indexed sessionId, uint256 agreedPrice, address buyer, address seller);
    event NegotiationExpired(bytes32 indexed sessionId);
    event SessionCancelled(bytes32 indexed sessionId, address cancelledBy);

    modifier sessionExists(bytes32 sessionId) {
        require(sessions[sessionId].buyer != address(0), "Session does not exist");
        _;
    }

    modifier onlyBuyer(bytes32 sessionId) {
        require(sessions[sessionId].buyer == msg.sender, "Not the buyer");
        _;
    }

    modifier onlySeller(bytes32 sessionId) {
        require(sessions[sessionId].seller == msg.sender, "Not the seller");
        _;
    }

    modifier sessionActive(bytes32 sessionId) {
        Session storage s = sessions[sessionId];
        require(
            s.status == SessionStatus.OPEN || s.status == SessionStatus.ACTIVE,
            "Session not active"
        );
        require(block.timestamp < s.deadline, "Session expired");
        _;
    }

    function openSession(
        address seller,
        string calldata serviceDescription,
        uint256 buyerBudgetCap,
        uint256 maxRounds,
        uint256 durationSeconds
    ) external returns (bytes32 sessionId) {
        require(seller != msg.sender, "Buyer and seller must differ");
        require(seller != address(0), "Invalid seller");
        require(buyerBudgetCap > 0, "Budget cap must be positive");
        require(maxRounds >= 1 && maxRounds <= 10, "Max rounds must be 1-10");
        require(durationSeconds >= 60, "Minimum 60 second duration");

        sessionId = keccak256(abi.encodePacked(
            msg.sender, seller, block.timestamp, block.number
        ));

        require(sessions[sessionId].buyer == address(0), "Session ID collision");

        Session storage s = sessions[sessionId];
        s.sessionId = sessionId;
        s.buyer = msg.sender;
        s.seller = seller;
        s.serviceDescription = serviceDescription;
        s.buyerBudgetCap = buyerBudgetCap;
        s.currentRound = 0;
        s.maxRounds = maxRounds;
        s.agreedPrice = 0;
        s.deadline = block.timestamp + durationSeconds;
        s.status = SessionStatus.OPEN;

        sessionIds.push(sessionId);
        buyerSessions[msg.sender].push(sessionId);
        sellerSessions[seller].push(sessionId);

        emit SessionOpened(sessionId, msg.sender, seller, serviceDescription);
        return sessionId;
    }

    function submitSellerAsk(bytes32 sessionId, uint256 askAmount)
        external
        sessionExists(sessionId)
        onlySeller(sessionId)
        sessionActive(sessionId)
    {
        Session storage s = sessions[sessionId];

        if (s.status == SessionStatus.OPEN) {
            s.status = SessionStatus.ACTIVE;
            emit SellerJoined(sessionId, msg.sender);
        }

        require(s.sellerOffers.length == s.currentRound, "Already submitted this round");
        require(askAmount > 0, "Ask must be positive");

        s.sellerOffers.push(askAmount);
        emit OfferSubmitted(sessionId, s.currentRound, "seller", askAmount);

        _checkConvergenceAndAdvance(sessionId);
    }

    function submitBuyerBid(bytes32 sessionId, uint256 bidAmount)
        external
        sessionExists(sessionId)
        onlyBuyer(sessionId)
        sessionActive(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(s.status == SessionStatus.ACTIVE, "Seller must join first");
        require(bidAmount <= s.buyerBudgetCap, "Bid exceeds budget cap");

        require(s.buyerOffers.length == s.currentRound, "Already submitted this round");
        require(bidAmount > 0, "Bid must be positive");

        s.buyerOffers.push(bidAmount);
        emit OfferSubmitted(sessionId, s.currentRound, "buyer", bidAmount);

        _checkConvergenceAndAdvance(sessionId);
    }

    function _checkConvergenceAndAdvance(bytes32 sessionId) internal {
        Session storage s = sessions[sessionId];

        if (s.buyerOffers.length != s.sellerOffers.length) return;
        if (s.buyerOffers.length == 0) return;

        uint256 latestBid = s.buyerOffers[s.buyerOffers.length - 1];
        uint256 latestAsk = s.sellerOffers[s.sellerOffers.length - 1];

        if (latestBid >= latestAsk) {
            s.agreedPrice = (latestBid + latestAsk) / 2;
            s.status = SessionStatus.AGREED;
            emit DealReached(sessionId, s.agreedPrice, s.buyer, s.seller);
            return;
        }

        if (s.currentRound + 1 >= s.maxRounds) {
            s.status = SessionStatus.EXPIRED;
            emit NegotiationExpired(sessionId);
            return;
        }

        s.currentRound += 1;
    }

    function expireSession(bytes32 sessionId)
        external
        sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(block.timestamp >= s.deadline, "Session not yet expired");
        require(
            s.status == SessionStatus.OPEN || s.status == SessionStatus.ACTIVE,
            "Session already resolved"
        );
        s.status = SessionStatus.EXPIRED;
        emit NegotiationExpired(sessionId);
    }

    function cancelSession(bytes32 sessionId)
        external
        sessionExists(sessionId)
    {
        Session storage s = sessions[sessionId];
        require(msg.sender == s.buyer, "Only buyer can cancel");
        require(
            s.status == SessionStatus.OPEN || s.status == SessionStatus.ACTIVE,
            "Session already resolved"
        );
        s.status = SessionStatus.CANCELLED;
        emit SessionCancelled(sessionId, msg.sender);
    }

    function getSession(bytes32 sessionId)
        external view returns (Session memory)
    {
        return sessions[sessionId];
    }

    function getLatestOffers(bytes32 sessionId)
        external view returns (uint256 latestBid, uint256 latestAsk, uint256 round)
    {
        Session storage s = sessions[sessionId];
        latestBid = s.buyerOffers.length > 0
            ? s.buyerOffers[s.buyerOffers.length - 1] : 0;
        latestAsk = s.sellerOffers.length > 0
            ? s.sellerOffers[s.sellerOffers.length - 1] : 0;
        round = s.currentRound;
    }

    function getOfferHistory(bytes32 sessionId)
        external view returns (uint256[] memory bids, uint256[] memory asks)
    {
        Session storage s = sessions[sessionId];
        return (s.buyerOffers, s.sellerOffers);
    }

    function getOpenSessionsForSeller(address seller)
        external view returns (bytes32[] memory openSessions)
    {
        bytes32[] storage all = sellerSessions[seller];
        uint256 count = 0;

        for (uint i = 0; i < all.length; i++) {
            if (sessions[all[i]].status == SessionStatus.OPEN) count++;
        }

        openSessions = new bytes32[](count);
        uint256 idx = 0;
        for (uint i = 0; i < all.length && idx < count; i++) {
            if (sessions[all[i]].status == SessionStatus.OPEN) {
                openSessions[idx++] = all[i];
            }
        }
    }

    function getTotalSessions() external view returns (uint256) {
        return sessionIds.length;
    }
}
