use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

declare_id!("36qH8uWkekoCa8qzFcBCkmZqUr9Y9JzFgtwct7RsJrTk");

#[program]
pub mod dex_complete {
    use super::*;

    // DEPLOY TOKEN
    pub fn deploy_token(
        ctx: Context<DeployToken>,
        name: String,
        symbol: String,
        decimals: u8,
        total_supply: u64,
    ) -> Result<()> {
        require!(decimals <= 18, DexError::InvalidDecimals);
        require!(!name.is_empty() && !symbol.is_empty(), DexError::InvalidTokenName);
        
        msg!("Deploying token: {} ({})", name, symbol);
        
        token::initialize_mint(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::InitializeMint {
                    mint: ctx.accounts.mint.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
            ),
            decimals,
            &ctx.accounts.authority.key(),
            Some(&ctx.accounts.authority.key()),
        )?;
        
        msg!("✅ Token deployed: {}", ctx.accounts.mint.key());
        Ok(())
    }

    // INITIALIZE - Program initialization
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("DEX Initialized by {}", ctx.accounts.user.key());
        Ok(())
    }

    // CREATE POOL
    pub fn create_pool(ctx: Context<CreatePool>, fee: u16) -> Result<()> {
        require!(fee <= 10000, DexError::InvalidFee);
        require!(ctx.accounts.token_a.key() != ctx.accounts.token_b.key(), DexError::IdenticalTokens);
        
        let pool = &mut ctx.accounts.pool;
        pool.token_a = ctx.accounts.token_a.key();
        pool.token_b = ctx.accounts.token_b.key();
        pool.fee = fee;
        pool.authority = ctx.accounts.authority.key();
        pool.total_liquidity = 0;
        pool.reserve_a = 0;
        pool.reserve_b = 0;
        
        msg!("Pool created: {} / {}", ctx.accounts.token_a.key(), ctx.accounts.token_b.key());
        Ok(())
    }

    // ADD LIQUIDITY
    pub fn add_liquidity(ctx: Context<AddLiquidity>, amount: u64) -> Result<()> {
        require!(amount > 0, DexError::InvalidAmount);
        
        let pool = &mut ctx.accounts.pool;
        
        // Calculate LP tokens to mint
        let lp_to_mint = if pool.total_liquidity == 0 {
            // First liquidity provider
            (amount as u128)
                .checked_mul(amount as u128)
                .and_then(|v| v.checked_sqrt())
                .ok_or(DexError::MathOverflow)? as u64
        } else {
            // Subsequent providers
            ((amount as u128)
                .checked_mul(pool.total_liquidity as u128)
                .ok_or(DexError::MathOverflow)? / (pool.reserve_a as u128)) as u64
        };

        pool.total_liquidity = pool
            .total_liquidity
            .checked_add(lp_to_mint)
            .ok_or(DexError::MathOverflow)?;
        
        pool.reserve_a = pool
            .reserve_a
            .checked_add(amount)
            .ok_or(DexError::MathOverflow)?;
        
        pool.reserve_b = pool
            .reserve_b
            .checked_add(amount)
            .ok_or(DexError::MathOverflow)?;

        msg!("Liquidity added: {} tokens -> {} LP tokens", amount, lp_to_mint);
        Ok(())
    }

    // REMOVE LIQUIDITY
    pub fn remove_liquidity(ctx: Context<RemoveLiquidity>, lp_amount: u64) -> Result<()> {
        require!(lp_amount > 0, DexError::InvalidAmount);
        
        let pool = &mut ctx.accounts.pool;
        require!(pool.total_liquidity >= lp_amount, DexError::InsufficientLiquidity);

        // Calculate amounts to return
        let amount_a = ((lp_amount as u128)
            .checked_mul(pool.reserve_a as u128)
            .ok_or(DexError::MathOverflow)? / (pool.total_liquidity as u128)) as u64;

        let amount_b = ((lp_amount as u128)
            .checked_mul(pool.reserve_b as u128)
            .ok_or(DexError::MathOverflow)? / (pool.total_liquidity as u128)) as u64;

        pool.total_liquidity = pool
            .total_liquidity
            .checked_sub(lp_amount)
            .ok_or(DexError::MathOverflow)?;
        
        pool.reserve_a = pool
            .reserve_a
            .checked_sub(amount_a)
            .ok_or(DexError::MathOverflow)?;
        
        pool.reserve_b = pool
            .reserve_b
            .checked_sub(amount_b)
            .ok_or(DexError::MathOverflow)?;

        msg!("Liquidity removed: {} LP -> {} + {} tokens", lp_amount, amount_a, amount_b);
        Ok(())
    }

    // SWAP
    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        require!(amount_in > 0, DexError::InvalidAmount);

        let pool = &mut ctx.accounts.pool;
        
        // Determine swap direction
        let (reserve_in, reserve_out, is_a_to_b) = if ctx.accounts.token_in.key() == pool.token_a {
            require!(ctx.accounts.token_out.key() == pool.token_b, DexError::InvalidTokenPair);
            (pool.reserve_a, pool.reserve_b, true)
        } else {
            require!(ctx.accounts.token_in.key() == pool.token_b, DexError::InvalidTokenPair);
            require!(ctx.accounts.token_out.key() == pool.token_a, DexError::InvalidTokenPair);
            (pool.reserve_b, pool.reserve_a, false)
        };

        // Calculate amount out using constant product formula: x * y = k
        // amount_out = (amount_in * (10000 - fee) / 10000) * reserve_out / (reserve_in + amount_in * (10000 - fee) / 10000)
        let amount_in_with_fee = (amount_in as u128)
            .checked_mul(10000u128 - pool.fee as u128)
            .ok_or(DexError::MathOverflow)?
            / 10000u128;

        let denominator = (reserve_in as u128)
            .checked_add(amount_in_with_fee)
            .ok_or(DexError::MathOverflow)?;

        let amount_out = (amount_in_with_fee
            .checked_mul(reserve_out as u128)
            .ok_or(DexError::MathOverflow)?)
            / denominator;

        require!(amount_out >= minimum_amount_out as u128, DexError::SlippageExceeded);

        // Update reserves
        if is_a_to_b {
            pool.reserve_a = pool
                .reserve_a
                .checked_add(amount_in)
                .ok_or(DexError::MathOverflow)?;
            pool.reserve_b = pool
                .reserve_b
                .checked_sub(amount_out as u64)
                .ok_or(DexError::InsufficientLiquidity)?;
        } else {
            pool.reserve_b = pool
                .reserve_b
                .checked_add(amount_in)
                .ok_or(DexError::MathOverflow)?;
            pool.reserve_a = pool
                .reserve_a
                .checked_sub(amount_out as u64)
                .ok_or(DexError::InsufficientLiquidity)?;
        }

        msg!("Swap executed: {} -> {} tokens", amount_in, amount_out);
        Ok(())
    }
}

// ACCOUNTS STRUCTURES

#[derive(Accounts)]
pub struct DeployToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = authority,
    )]
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 2 + 32 + 8 + 8 + 8, // discriminator + fields
    )]
    pub pool: Account<'info, PoolAccount>,
    pub token_a: Account<'info, Mint>,
    pub token_b: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, PoolAccount>,
}

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, PoolAccount>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, PoolAccount>,
    pub token_in: Account<'info, Mint>,
    pub token_out: Account<'info, Mint>,
}

// ACCOUNT DATA STRUCTURES

#[account]
pub struct PoolAccount {
    pub token_a: Pubkey,      // 32 bytes
    pub token_b: Pubkey,      // 32 bytes
    pub fee: u16,             // 2 bytes
    pub authority: Pubkey,    // 32 bytes
    pub total_liquidity: u64, // 8 bytes
    pub reserve_a: u64,       // 8 bytes (NEW)
    pub reserve_b: u64,       // 8 bytes (NEW)
}

// ERROR CODES

#[error_code]
pub enum DexError {
    #[msg("Invalid fee (must be 0-10000 BPS)")]
    InvalidFee,
    #[msg("Identical tokens not allowed")]
    IdenticalTokens,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient liquidity")]
    InsufficientLiquidity,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Slippage exceeded")]
    SlippageExceeded,
    #[msg("Invalid token pair")]
    InvalidTokenPair,
    #[msg("Invalid decimals")]
    InvalidDecimals,
    #[msg("Invalid token name")]
    InvalidTokenName,
}
