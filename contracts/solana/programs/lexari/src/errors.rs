use anchor_lang::prelude::*;

#[error_code]
pub enum LexariError {
    #[msg("Name is empty or longer than 32 bytes")]
    BadName,
    #[msg("Role is longer than 32 bytes")]
    BadRole,
    #[msg("Face DNA is empty or longer than 180 bytes")]
    BadDna,
    #[msg("Memory URI is longer than 200 bytes")]
    BadUri,
    #[msg("That memory is already revoked")]
    AlreadyRevoked,
    #[msg("Already checked in today")]
    AlreadyCheckedIn,
    #[msg("Not enough coins")]
    InsufficientCoins,
    #[msg("Agent is already at max level")]
    MaxLevel,
    #[msg("Attestor does not match config authority")]
    BadAttestor,
    #[msg("Cannot refer yourself")]
    SelfReferral,
    #[msg("Referral tier is invalid or already claimed")]
    BadTier,
    #[msg("Quest already claimed for this period")]
    QuestClaimed,
    #[msg("Mystery box already opened today")]
    BoxOpened,
    #[msg("Level-up spend must be greater than zero")]
    ZeroSpend,
    #[msg("Config already initialized")]
    ConfigExists,
    #[msg("Only the program upgrade authority can change config")]
    NotUpgradeAuthority,
    #[msg("Asset is not a Metaplex Core asset")]
    NotCoreAsset,
    #[msg("Signer does not own this Core asset")]
    NotAssetOwner,
    #[msg("Asset account does not match the agent")]
    AssetMismatch,
    #[msg("Agent owner is already up to date")]
    OwnerUnchanged,
    #[msg("Reward is above the per-claim cap")]
    RewardTooLarge,
}
