use anchor_lang::prelude::*;

declare_id!("BbnD28xf3kwfQRiRA6VQmw4p2R55WivUgozSoo81M6Po");

/// Agent registry and memory records.
/// The ID card itself is a Metaplex Core asset. This program records who owns
/// that asset and the memory hashes the owner can revoke or delete.
#[program]
pub mod lexari {
    use super::*;

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        asset: Pubkey,
        name: String,
        role: String,
        dna: String,
    ) -> Result<()> {
        check_name(&name)?;
        check_role(&role)?;
        check_dna(&dna)?;
        let agent = &mut ctx.accounts.agent;
        agent.owner = ctx.accounts.owner.key();
        agent.asset = asset;
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
        let agent = &mut ctx.accounts.agent;
        agent.name = name;
        agent.role = role;
        agent.dna = dna;
        Ok(())
    }

    /// Stores a hash of the memory and an optional URI (Arweave or similar) where the ciphertext lives.
    pub fn write_memory(ctx: Context<WriteMemory>, content_hash: [u8; 32], uri: String) -> Result<()> {
        check_uri(&uri)?;
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

    /// Closes the record and returns the rent to the owner. The hash can be written again later.
    pub fn delete_memory(_ctx: Context<DeleteMemory>) -> Result<()> {
        Ok(())
    }
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
#[instruction(asset: Pubkey)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + Agent::SIZE,
        seeds = [b"agent", owner.key().as_ref(), asset.as_ref()],
        bump
    )]
    pub agent: Account<'info, Agent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    pub owner: Signer<'info>,
    #[account(mut, has_one = owner)]
    pub agent: Account<'info, Agent>,
}

#[derive(Accounts)]
#[instruction(content_hash: [u8; 32])]
pub struct WriteMemory<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(has_one = owner)]
    pub agent: Account<'info, Agent>,
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

#[account]
pub struct Agent {
    pub owner: Pubkey,
    pub asset: Pubkey,
    pub name: String,
    pub role: String,
    pub dna: String,
    pub bump: u8,
}

impl Agent {
    pub const MAX_NAME: usize = 32;
    pub const MAX_ROLE: usize = 32;
    pub const MAX_DNA: usize = 180;
    pub const SIZE: usize = 32 + 32 + 4 + Self::MAX_NAME + 4 + Self::MAX_ROLE + 4 + Self::MAX_DNA + 1;
}

#[account]
pub struct Memory {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub content_hash: [u8; 32],
    pub uri: String,
    pub revoked: bool,
    pub bump: u8,
}

impl Memory {
    pub const MAX_URI: usize = 200;
    pub const SIZE: usize = 32 + 32 + 32 + 4 + Self::MAX_URI + 1 + 1;
}

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
}
