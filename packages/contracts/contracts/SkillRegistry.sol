// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SkillRegistry {

    enum SkillType {
        IDENTITY,
        NEGOTIATION,
        PAYMENT_X402,
        PAYMENT_SERVER,
        STRATEGY_AI
    }

    struct SkillAttestation {
        address agent;
        SkillType skill;
        string sdkVersion;
        string framework;
        uint256 attestedAt;
        bool isActive;
    }

    mapping(address => mapping(uint8 => SkillAttestation)) public attestations;
    mapping(address => uint8[]) public agentSkills;
    mapping(uint8 => address[]) public skillHolders;

    event SkillAttested(address indexed agent, SkillType skill, string sdkVersion);
    event SkillRevoked(address indexed agent, SkillType skill);

    function attestSkill(SkillType skill, string calldata sdkVersion, string calldata framework) external {
        uint8 skillId = uint8(skill);

        attestations[msg.sender][skillId] = SkillAttestation({
            agent: msg.sender,
            skill: skill,
            sdkVersion: sdkVersion,
            framework: framework,
            attestedAt: block.timestamp,
            isActive: true
        });

        bool found = false;
        for (uint i = 0; i < agentSkills[msg.sender].length; i++) {
            if (agentSkills[msg.sender][i] == skillId) { found = true; break; }
        }
        if (!found) agentSkills[msg.sender].push(skillId);

        found = false;
        for (uint i = 0; i < skillHolders[skillId].length; i++) {
            if (skillHolders[skillId][i] == msg.sender) { found = true; break; }
        }
        if (!found) skillHolders[skillId].push(msg.sender);

        emit SkillAttested(msg.sender, skill, sdkVersion);
    }

    function revokeSkill(SkillType skill) external {
        uint8 skillId = uint8(skill);
        require(attestations[msg.sender][skillId].isActive, "Skill not attested");
        attestations[msg.sender][skillId].isActive = false;
        emit SkillRevoked(msg.sender, skill);
    }

    function hasSkill(address agent, SkillType skill) external view returns (bool) {
        return attestations[agent][uint8(skill)].isActive;
    }

    function getAgentSkills(address agent) external view returns (uint8[] memory) {
        return agentSkills[agent];
    }

    function getSkillHolders(SkillType skill) external view returns (address[] memory) {
        return skillHolders[uint8(skill)];
    }

    function getAttestation(address agent, SkillType skill) external view returns (SkillAttestation memory) {
        return attestations[agent][uint8(skill)];
    }

    function isFullyCapable(address agent) external view returns (bool) {
        for (uint8 i = 0; i < 5; i++) {
            if (!attestations[agent][i].isActive) return false;
        }
        return true;
    }
}
