use anchor_lang::prelude::*;

pub mod errors;
pub mod state;

use errors::LexariError;
use state::*;

declare_id!("BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po");

/// Marker so `Program<LexariId>` checks the executable account is this program.
#[derive(Clone)]
pub struct LexariId;

impl Id for LexariId {
    fn id() -> Pubkey {
        crate::ID
    }
}

/// Agent registry, memory records, and Hub (coins, check-in, quests, levels).
/// The ID card itself is a Metaplex Core asset.
#[program]
pub mod lexari {
    use super::*;

    /// Registers the agent record for a Metaplex Core asset. The signer must own the asset.
    pub fn register_agent(ctx: Context<RegisterAgent>, name: String, role: String, dna: String) -> Result<()> {
        check_name(&name)?;
        check_role(&role)?;
        check_dna(&dna)?;
        let owner = ctx.accounts.owner.key();
        require_keys_eq!(core_owner(&ctx.accounts.asset)?, owner, LexariError::NotAssetOwner);
        let agent = &mut ctx.accounts.agent;
        agent.owner = owner;
        agent.asset = ctx.accounts.asset.key();
        agent.name = name;
        agent.role = role;
        agent.dna = dna;
        agent.bump = ctx.bumps.agent;
        Ok(())
    }

    pub fn update_agent(ctx: Context<UpdateAgent>, name: String, role: String, dna: String) -> Result<()> {
        check_name(&name)?;
        check_role(&role)?;
        check_dna(&dna)?;
        require_keys_eq!(core_owner(&ctx.accounts.asset)?, ctx.accounts.owner.key(), LexariError::NotAssetOwner);
        let agent = &mut ctx.accounts.agent;
        agent.name = name;
        agent.role = role;
        agent.dna = dna;
        Ok(())
    }

    /// After the ID card (Core asset) changes hands, its new owner takes over the agent record.
    pub fn sync_agent_owner(ctx: Context<SyncAgentOwner>) -> Result<()> {
        let new_owner = ctx.accounts.new_owner.key();
        require_keys_eq!(core_owner(&ctx.accounts.asset)?, new_owner, LexariError::NotAssetOwner);
        let agent = &mut ctx.accounts.agent;
        require_keys_neq!(agent.owner, new_owner, LexariError::OwnerUnchanged);
        agent.owner = new_owner;
        Ok(())
    }

    pub fn write_memory(ctx: Context<WriteMemory>, content_hash: [u8; 32], uri: String) -> Result<()> {
        check_uri(&uri)?;
        require_keys_eq!(core_owner(&ctx.accounts.asset)?, ctx.accounts.owner.key(), LexariError::NotAssetOwner);
        let memory = &mut ctx.accounts.memory;
        memory.owner = ctx.accounts.owner.key();
        memory.agent = ctx.accounts.agent.key();
        memory.content_hash = content_hash;
        memory.uri = uri;
        memory.revoked = false;
        memory.bump = ctx.bumps.memory;
        Ok(())
    }

    pub fn revoke_memory(ctx: Context<RevokeMemory>) -> Result<()> {
        let memory = &mut ctx.accounts.memory;
        require!(!memory.revoked, LexariError::AlreadyRevoked);
        memory.revoked = true;
        Ok(())
    }

    pub fn delete_memory(_ctx: Context<DeleteMemory>) -> Result<()> {
        Ok(())
    }

    pub fn init_config(ctx: Context<InitConfig>, authority: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = authority;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Rotates the attestor. Only the program upgrade authority can call it.
    pub fn update_config(ctx: Context<UpdateConfig>, authority: Pubkey) -> Result<()> {
        ctx.accounts.config.authority = authority;
        Ok(())
    }

    pub fn init_player(ctx: Context<InitPlayer>) -> Result<()> {
        let owner = ctx.accounts.owner.key();
        let referrer = ctx.accounts.referrer_player.as_ref().map(|p| p.owner);
        if let Some(r) = referrer {
            require!(r != owner, LexariError::SelfReferral);
        }
        let player = &mut ctx.accounts.player;
        player.owner = owner;
        player.coins = 0;
        player.streak = 0;
        player.last_check_in = 0;
        player.referrer = referrer;
        player.lifetime = 0;
        player.bump = ctx.bumps.player;
        Ok(())
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let today = utc_day(now);
        let player = &mut ctx.accounts.player;
        if player.last_check_in != 0 {
            let last = utc_day(player.last_check_in);
            require!(last < today, LexariError::AlreadyCheckedIn);
            player.streak = if last == today - 1 { player.streak.saturating_add(1) } else { 1 };
        } else {
            player.streak = 1;
        }
        let idx = (player.streak.saturating_sub(1) as usize).min(STREAK_PAY.len() - 1);
        let pay = STREAK_PAY[idx];
        player.coins = player.coins.saturating_add(pay);
        player.lifetime = player.lifetime.saturating_add(pay);
        player.last_check_in = now;
        Ok(())
    }

    pub fn claim_quest(ctx: Context<ClaimQuest>, quest_id: u16, period: u32, coins: u64) -> Result<()> {
        require!(
            ctx.accounts.attestor.key() == ctx.accounts.config.authority,
            LexariError::BadAttestor
        );
        require!(coins <= MAX_QUEST_COINS, LexariError::RewardTooLarge);
        let claim = &mut ctx.accounts.claim;
        claim.player = ctx.accounts.player.key();
        claim.quest_id = quest_id;
        claim.period = period;
        claim.coins = coins;
        claim.bump = ctx.bumps.claim;
        let player = &mut ctx.accounts.player;
        player.coins = player.coins.saturating_add(coins);
        player.lifetime = player.lifetime.saturating_add(coins);
        Ok(())
    }

    pub fn open_box(ctx: Context<OpenBox>, day: u32, coins: u64) -> Result<()> {
        require!(
            ctx.accounts.attestor.key() == ctx.accounts.config.authority,
            LexariError::BadAttestor
        );
        require!(coins <= MAX_BOX_COINS, LexariError::RewardTooLarge);
        let claim = &mut ctx.accounts.claim;
        claim.player = ctx.accounts.player.key();
        claim.day = day;
        claim.coins = coins;
        claim.bump = ctx.bumps.claim;
        let player = &mut ctx.accounts.player;
        player.coins = player.coins.saturating_add(coins);
        player.lifetime = player.lifetime.saturating_add(coins);
        Ok(())
    }

    /// Spends coins as XP on an agent. Never spends more than it takes to reach the max level.
    pub fn level_up(ctx: Context<LevelUp>, coins: u64) -> Result<()> {
        require!(coins > 0, LexariError::ZeroSpend);
        require_keys_eq!(core_owner(&ctx.accounts.asset)?, ctx.accounts.owner.key(), LexariError::NotAssetOwner);
        let player = &mut ctx.accounts.player;
        let level = &mut ctx.accounts.level;
        if level.level == 0 {
            level.agent = ctx.accounts.agent.key();
            level.level = 1;
            level.xp = 0;
            level.bump = ctx.bumps.level;
        }
        level.owner = player.owner;
        require!(level.level < AgentLevel::MAX_LEVEL, LexariError::MaxLevel);
        let mut lv = level.level;
        let mut xp = u64::from(level.xp);
        let mut need: u64 = 0;
        for l in lv..AgentLevel::MAX_LEVEL {
            need = need.saturating_add(xp_for(l));
        }
        need = need.saturating_sub(xp);
        let spend = coins.min(need);
        require!(player.coins >= spend, LexariError::InsufficientCoins);
        player.coins -= spend;
        xp = xp.saturating_add(spend);
        while lv < AgentLevel::MAX_LEVEL && xp >= xp_for(lv) {
            xp -= xp_for(lv);
            lv += 1;
        }
        if lv >= AgentLevel::MAX_LEVEL {
            xp = 0;
        }
        level.level = lv;
        level.xp = u32::try_from(xp).map_err(|_| error!(LexariError::ZeroSpend))?;
        Ok(())
    }

    pub fn claim_referral_tier(ctx: Context<ClaimReferralTier>, tier: u8) -> Result<()> {
        require!(
            ctx.accounts.attestor.key() == ctx.accounts.config.authority,
            LexariError::BadAttestor
        );
        require!((tier as usize) < TIER_REWARD.len(), LexariError::BadTier);
        let reward = TIER_REWARD[tier as usize];
        let claim = &mut ctx.accounts.claim;
        claim.player = ctx.accounts.player.key();
        claim.tier = tier;
        claim.bump = ctx.bumps.claim;
        let player = &mut ctx.accounts.player;
        player.coins = player.coins.saturating_add(reward);
        player.lifetime = player.lifetime.saturating_add(reward);
        Ok(())
    }
}

/// Owner of a Metaplex Core AssetV1 account.
fn core_owner(asset: &AccountInfo) -> Result<Pubkey> {
    require_keys_eq!(*asset.owner, MPL_CORE_ID, LexariError::NotCoreAsset);
    let data = asset.try_borrow_data()?;
    require!(data.len() >= 33 && data[0] == CORE_KEY_ASSET_V1, LexariError::NotCoreAsset);
    Ok(Pubkey::new_from_array(data[1..33].try_into().unwrap()))
}

fn check_name(name: &str) -> Result<()> {
    require!(!name.is_empty() && name.len() <= Agent::MAX_NAME, LexariError::BadName);
    Ok(())
}
fn check_role(role: &str) -> Result<()> {
    require!(role.len() <= Agent::MAX_ROLE, LexariError::BadRole);
    Ok(())
}
fn check_dna(dna: &str) -> Result<()> {
    require!(!dna.is_empty() && dna.len() <= Agent::MAX_DNA, LexariError::BadDna);
    Ok(())
}
fn check_uri(uri: &str) -> Result<()> {
    require!(uri.len() <= Memory::MAX_URI, LexariError::BadUri);
    Ok(())
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: checked in core_owner(): a Metaplex Core AssetV1 owned by `owner`.
    pub asset: UncheckedAccount<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Agent::SIZE,
        seeds = [b"agent", asset.key().as_ref()],
        bump
    )]
    pub agent: Account<'info, Agent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner, has_one = asset @ LexariError::AssetMismatch, seeds = [b"agent", asset.key().as_ref()], bump = agent.bump)]
    pub agent: Account<'info, Agent>,
    /// CHECK: must be agent.asset; ownership checked in core_owner().
    pub asset: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SyncAgentOwner<'info> {
    pub new_owner: Signer<'info>,
    #[account(mut, has_one = asset @ LexariError::AssetMismatch, seeds = [b"agent", asset.key().as_ref()], bump = agent.bump)]
    pub agent: Account<'info, Agent>,
    /// CHECK: must be agent.asset; ownership checked in core_owner().
    pub asset: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(content_hash: [u8; 32])]
pub struct WriteMemory<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(has_one = owner, has_one = asset @ LexariError::AssetMismatch)]
    pub agent: Account<'info, Agent>,
    /// CHECK: must be agent.asset; ownership checked in core_owner().
    pub asset: UncheckedAccount<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Memory::SIZE,
        seeds = [b"memory", agent.key().as_ref(), content_hash.as_ref()],
        bump
    )]
    pub memory: Account<'info, Memory>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeMemory<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner)]
    pub memory: Account<'info, Memory>,
}

#[derive(Accounts)]
pub struct DeleteMemory<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        close = owner,
        has_one = owner,
        seeds = [b"memory", memory.agent.as_ref(), memory.content_hash.as_ref()],
        bump = memory.bump
    )]
    pub memory: Account<'info, Memory>,
}

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Config::SIZE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, LexariId>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(payer.key()) @ LexariError::NotUpgradeAuthority
    )]
    pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, LexariId>,
    #[account(
        constraint = program_data.upgrade_authority_address == Some(authority.key()) @ LexariError::NotUpgradeAuthority
    )]
    pub program_data: Account<'info, ProgramData>,
}

#[derive(Accounts)]
pub struct InitPlayer<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Player::SIZE,
        seeds = [b"player", owner.key().as_ref()],
        bump
    )]
    pub player: Account<'info, Player>,
    pub referrer_player: Option<Account<'info, Player>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckIn<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner, seeds = [b"player", owner.key().as_ref()], bump = player.bump)]
    pub player: Account<'info, Player>,
}

#[derive(Accounts)]
#[instruction(quest_id: u16, period: u32)]
pub struct ClaimQuest<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub attestor: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = owner, seeds = [b"player", owner.key().as_ref()], bump = player.bump)]
    pub player: Account<'info, Player>,
    #[account(
        init,
        payer = owner,
        space = 8 + QuestClaim::SIZE,
        seeds = [b"quest", player.key().as_ref(), &quest_id.to_le_bytes(), &period.to_le_bytes()],
        bump
    )]
    pub claim: Account<'info, QuestClaim>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(day: u32)]
pub struct OpenBox<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub attestor: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = owner, seeds = [b"player", owner.key().as_ref()], bump = player.bump)]
    pub player: Account<'info, Player>,
    #[account(
        init,
        payer = owner,
        space = 8 + BoxClaim::SIZE,
        seeds = [b"box", player.key().as_ref(), &day.to_le_bytes()],
        bump
    )]
    pub claim: Account<'info, BoxClaim>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LevelUp<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner, seeds = [b"player", owner.key().as_ref()], bump = player.bump)]
    pub player: Account<'info, Player>,
    #[account(has_one = owner, has_one = asset @ LexariError::AssetMismatch)]
    pub agent: Account<'info, Agent>,
    /// CHECK: must be agent.asset; ownership checked in core_owner().
    pub asset: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + AgentLevel::SIZE,
        seeds = [b"level", agent.key().as_ref()],
        bump
    )]
    pub level: Account<'info, AgentLevel>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(tier: u8)]
pub struct ClaimReferralTier<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    pub attestor: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, has_one = owner, seeds = [b"player", owner.key().as_ref()], bump = player.bump)]
    pub player: Account<'info, Player>,
    #[account(
        init,
        payer = owner,
        space = 8 + ReferralClaim::SIZE,
        seeds = [b"ref", player.key().as_ref(), &[tier]],
        bump
    )]
    pub claim: Account<'info, ReferralClaim>,
    pub system_program: Program<'info, System>,
}
