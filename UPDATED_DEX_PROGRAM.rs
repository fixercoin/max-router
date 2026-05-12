use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo, Burn};

declare_id!("36qH8uWkekoCa8qzFcBCkmZqUr9Y9JzFgtwct7RsJrTk");

const FIXED_SUPPLY: u64 = 1_000_000_000;
const AUTO_BURN_PERCENTAGE: u64 = 20;
const AUTO_BURN_DAYS: u64 = 730;
const SWAP_FEE_BPS: u16 = 1;

#[program]
pub mod max {
    use super::*;

    pub fn initialize_dex(ctx: Context<InitializeDex>, dex_authority: Pubkey) -> Result<()> {
        let dex_state = &mut ctx.accounts.dex_state;
        dex_state.authority = dex_authority;
        dex_state.token_count = 0;
        dex_state.pool_count = 0;
        dex_state.total_volume = 0;
        dex_state.creation_timestamp = Clock::get()?.unix_timestamp;
        
        msg!("MAX DEX initialized with authority: {}", dex_authority);
        Ok(())
    }

    pub fn deploy_token(
        ctx: Context<DeployToken>,
        name: String,
        symbol: String,
        decimals: u8,
    ) -> Result<()> {
        require!(decimals <= 18, DexError::InvalidDecimals);
        require!(!name.is_empty() && !symbol.is_empty(), DexError::InvalidTokenName);
        require!(name.len() <= 32 && symbol.len() <= 32, DexError::NameTooLong);
        
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

        let token_metadata = &mut ctx.accounts.token_metadata;
        token_metadata.mint = ctx.accounts.mint.key();
        token_metadata.name = name.clone();
        token_metadata.symbol = symbol.clone();
        token_metadata.decimals = decimals;
        token_metadata.total_supply = FIXED_SUPPLY;
        token_metadata.circulating_supply = FIXED_SUPPLY;
        token_metadata.creator = ctx.accounts.authority.key();
        token_metadata.creation_timestamp = Clock::get()?.unix_timestamp;
        token_metadata.logo_uri = String::new();
        token_metadata.description = String::new();
        token_metadata.holders_count = 0;
        token_metadata.is_verified = false;
        token_metadata.auto_burn_enabled = true;
        token_metadata.auto_burn_end_timestamp = Clock::get()?.unix_timestamp + (AUTO_BURN_DAYS * 24 * 3600);

        let dex_state = &mut ctx.accounts.dex_state;
        dex_state.token_count = dex_state.token_count.saturating_add(1);

        msg!("✅ Token deployed: {} ({}) - Supply: {}", name, symbol, FIXED_SUPPLY);
        Ok(())
    }

    pub fn mint_initial_supply(
        ctx: Context<MintInitialSupply>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, DexError::InvalidAmount);
        require!(amount <= FIXED_SUPPLY, DexError::ExceedsMaxSupply);

        let token_metadata = &mut ctx.accounts.token_metadata;
        require!(token_metadata.circulating_supply >= amount, DexError::InsufficientSupply);

        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        token_metadata.circulating_supply = token_metadata.circulating_supply.saturating_sub(amount);

        msg!("Minted {} tokens", amount);
        Ok(())
    }

    pub fn execute_auto_burn(ctx: Context<ExecuteAutoBurn>, amount: u64) -> Result<()> {
        let token_metadata = &mut ctx.accounts.token_metadata;
        let current_time = Clock::get()?.unix_timestamp;

        require!(token_metadata.auto_burn_enabled, DexError::BurnDisabled);
        require!(current_time < token_metadata.auto_burn_end_timestamp, DexError::BurnPeriodEnded);

        let total_burn_amount = (token_metadata.total_supply as u128)
            .checked_mul(AUTO_BURN_PERCENTAGE as u128)
            .ok_or(DexError::MathOverflow)?
            .checked_div(100)
            .ok_or(DexError::MathOverflow)? as u64;

        require!(amount <= total_burn_amount, DexError::InvalidBurnAmount);

        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    from: ctx.accounts.token_account.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;

        token_metadata.circulating_supply = token_metadata.circulating_supply.saturating_sub(amount);
        token_metadata.burned_amount = token_metadata.burned_amount.saturating_add(amount);

        msg!("Auto-burned {} tokens", amount);
        Ok(())
    }

    pub fn create_pool(
        ctx: Context<CreatePool>,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= 500, DexError::InvalidFee);
        require!(ctx.accounts.token_a.key() != ctx.accounts.token_b.key(), DexError::IdenticalTokens);
        
        let pool = &mut ctx.accounts.pool;
        pool.token_a = ctx.accounts.token_a.key();
        pool.token_b = ctx.accounts.token_b.key();
        pool.token_a_account = ctx.accounts.token_a_account.key();
        pool.token_b_account = ctx.accounts.token_b_account.key();
        pool.fee_bps = fee_bps;
        pool.authority = ctx.accounts.authority.key();
        pool.total_liquidity = 0;
        pool.reserve_a = 0;
        pool.reserve_b = 0;
        pool.creator = ctx.accounts.authority.key();
        pool.creation_timestamp = Clock::get()?.unix_timestamp;
        pool.total_volume = 0;
        pool.total_fees_collected = 0;
        pool.lp_token_supply = 0;

        let dex_state = &mut ctx.accounts.dex_state;
        dex_state.pool_count = dex_state.pool_count.saturating_add(1);

        msg!("Pool created: {} / {} with fee: {} BPS", 
             ctx.accounts.token_a.key(), 
             ctx.accounts.token_b.key(), 
             fee_bps);
        Ok(())
    }

    pub fn add_liquidity(
        ctx: Context<AddLiquidity>,
        amount_a: u64,
        amount_b: u64,
    ) -> Result<()> {
        require!(amount_a > 0 && amount_b > 0, DexError::InvalidAmount);
        
        let pool = &mut ctx.accounts.pool;

        let lp_to_mint = if pool.total_liquidity == 0 {
            let a_squared = (amount_a as u128)
                .checked_mul(amount_a as u128)
                .ok_or(DexError::MathOverflow)?;
            let b_squared = (amount_b as u128)
                .checked_mul(amount_b as u128)
                .ok_or(DexError::MathOverflow)?;
            
            let product = a_squared
                .checked_mul(b_squared)
                .ok_or(DexError::MathOverflow)?;
            
            (product as f64).sqrt() as u64
        } else {
            let ratio_a = ((amount_a as u128)
                .checked_mul(pool.total_liquidity as u128)
                .ok_or(DexError::MathOverflow)?)
                .checked_div(pool.reserve_a as u128)
                .ok_or(DexError::MathOverflow)? as u64;

            let ratio_b = ((amount_b as u128)
                .checked_mul(pool.total_liquidity as u128)
                .ok_or(DexError::MathOverflow)?)
                .checked_div(pool.reserve_b as u128)
                .ok_or(DexError::MathOverflow)? as u64;

            ratio_a.min(ratio_b)
        };

        require!(lp_to_mint > 0, DexError::InvalidAmount);

        pool.total_liquidity = pool.total_liquidity
            .checked_add(lp_to_mint)
            .ok_or(DexError::MathOverflow)?;
        pool.reserve_a = pool.reserve_a
            .checked_add(amount_a)
            .ok_or(DexError::MathOverflow)?;
        pool.reserve_b = pool.reserve_b
            .checked_add(amount_b)
            .ok_or(DexError::MathOverflow)?;
        pool.lp_token_supply = pool.lp_token_supply
            .checked_add(lp_to_mint)
            .ok_or(DexError::MathOverflow)?;

        let transaction = &mut ctx.accounts.transaction;
        transaction.pool = pool.key();
        transaction.user = ctx.accounts.user.key();
        transaction.tx_type = TransactionType::AddLiquidity;
        transaction.amount_a = amount_a;
        transaction.amount_b = amount_b;
        transaction.timestamp = Clock::get()?.unix_timestamp;

        msg!("Liquidity added: {} + {} tokens -> {} LP tokens", amount_a, amount_b, lp_to_mint);
        Ok(())
    }

    pub fn remove_liquidity(
        ctx: Context<RemoveLiquidity>,
        lp_amount: u64,
    ) -> Result<()> {
        require!(lp_amount > 0, DexError::InvalidAmount);
        
        let pool = &mut ctx.accounts.pool;
        require!(pool.total_liquidity >= lp_amount, DexError::InsufficientLiquidity);

        let amount_a = ((lp_amount as u128)
            .checked_mul(pool.reserve_a as u128)
            .ok_or(DexError::MathOverflow)?)
            .checked_div(pool.total_liquidity as u128)
            .ok_or(DexError::MathOverflow)? as u64;

        let amount_b = ((lp_amount as u128)
            .checked_mul(pool.reserve_b as u128)
            .ok_or(DexError::MathOverflow)?)
            .checked_div(pool.total_liquidity as u128)
            .ok_or(DexError::MathOverflow)? as u64;

        pool.total_liquidity = pool.total_liquidity
            .checked_sub(lp_amount)
            .ok_or(DexError::MathOverflow)?;
        pool.reserve_a = pool.reserve_a
            .checked_sub(amount_a)
            .ok_or(DexError::MathOverflow)?;
        pool.reserve_b = pool.reserve_b
            .checked_sub(amount_b)
            .ok_or(DexError::MathOverflow)?;
        pool.lp_token_supply = pool.lp_token_supply
            .checked_sub(lp_amount)
            .ok_or(DexError::MathOverflow)?;

        let transaction = &mut ctx.accounts.transaction;
        transaction.pool = pool.key();
        transaction.user = ctx.accounts.user.key();
        transaction.tx_type = TransactionType::RemoveLiquidity;
        transaction.amount_a = amount_a;
        transaction.amount_b = amount_b;
        transaction.timestamp = Clock::get()?.unix_timestamp;

        msg!("Liquidity removed: {} LP -> {} + {} tokens", lp_amount, amount_a, amount_b);
        Ok(())
    }

    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        require!(amount_in > 0, DexError::InvalidAmount);

        let pool = &mut ctx.accounts.pool;
        require!(pool.reserve_a > 0 && pool.reserve_b > 0, DexError::InsufficientLiquidity);

        let (reserve_in, reserve_out, is_a_to_b) = if ctx.accounts.token_in.key() == pool.token_a {
            require!(ctx.accounts.token_out.key() == pool.token_b, DexError::InvalidTokenPair);
            (pool.reserve_a, pool.reserve_b, true)
        } else {
            require!(ctx.accounts.token_in.key() == pool.token_b, DexError::InvalidTokenPair);
            require!(ctx.accounts.token_out.key() == pool.token_a, DexError::InvalidTokenPair);
            (pool.reserve_b, pool.reserve_a, false)
        };

        let fee_amount = ((amount_in as u128)
            .checked_mul(pool.fee_bps as u128)
            .ok_or(DexError::MathOverflow)?)
            .checked_div(10000)
            .ok_or(DexError::MathOverflow)? as u64;

        let amount_in_with_fee = amount_in
            .checked_sub(fee_amount)
            .ok_or(DexError::MathOverflow)?;

        let numerator = (amount_in_with_fee as u128)
            .checked_mul(reserve_out as u128)
            .ok_or(DexError::MathOverflow)?;

        let denominator = (reserve_in as u128)
            .checked_add(amount_in_with_fee as u128)
            .ok_or(DexError::MathOverflow)?;

        let amount_out = numerator
            .checked_div(denominator)
            .ok_or(DexError::MathOverflow)? as u64;

        require!(amount_out >= minimum_amount_out, DexError::SlippageExceeded);
        require!(amount_out <= reserve_out, DexError::InsufficientLiquidity);

        if is_a_to_b {
            pool.reserve_a = pool.reserve_a
                .checked_add(amount_in)
                .ok_or(DexError::MathOverflow)?;
            pool.reserve_b = pool.reserve_b
                .checked_sub(amount_out)
                .ok_or(DexError::MathOverflow)?;
        } else {
            pool.reserve_b = pool.reserve_b
                .checked_add(amount_in)
                .ok_or(DexError::MathOverflow)?;
            pool.reserve_a = pool.reserve_a
                .checked_sub(amount_out)
                .ok_or(DexError::MathOverflow)?;
        }

        pool.total_volume = pool.total_volume
            .checked_add(amount_in as u128)
            .ok_or(DexError::MathOverflow)?;
        pool.total_fees_collected = pool.total_fees_collected
            .checked_add(fee_amount as u128)
            .ok_or(DexError::MathOverflow)?;

        let transaction = &mut ctx.accounts.transaction;
        transaction.pool = pool.key();
        transaction.user = ctx.accounts.user.key();
        transaction.tx_type = TransactionType::Swap;
        transaction.amount_a = amount_in;
        transaction.amount_b = amount_out;
        transaction.fee = fee_amount;
        transaction.timestamp = Clock::get()?.unix_timestamp;

        let dex_state = &mut ctx.accounts.dex_state;
        dex_state.total_volume = dex_state.total_volume
            .checked_add(amount_in as u128)
            .ok_or(DexError::MathOverflow)?;

        msg!("Swap: {} in -> {} out (fee: {})", amount_in, amount_out, fee_amount);
        Ok(())
    }

    pub fn update_token_metadata(
        ctx: Context<UpdateTokenMetadata>,
        logo_uri: String,
        description: String,
    ) -> Result<()> {
        let token_metadata = &mut ctx.accounts.token_metadata;
        require!(token_metadata.creator == ctx.accounts.authority.key(), DexError::Unauthorized);
        require!(logo_uri.len() <= 256 && description.len() <= 512, DexError::DataTooLarge);

        token_metadata.logo_uri = logo_uri;
        token_metadata.description = description;

        msg!("Token metadata updated");
        Ok(())
    }

    pub fn record_holder(ctx: Context<RecordHolder>) -> Result<()> {
        let holder_record = &mut ctx.accounts.holder_record;
        holder_record.token_mint = ctx.accounts.token_metadata.mint;
        holder_record.holder = ctx.accounts.holder.key();
        holder_record.balance = 0;
        holder_record.first_seen = Clock::get()?.unix_timestamp;

        let token_metadata = &mut ctx.accounts.token_metadata;
        token_metadata.holders_count = token_metadata.holders_count.saturating_add(1);

        msg!("Holder recorded for token");
        Ok(())
    }

    pub fn verify_token(ctx: Context<VerifyToken>) -> Result<()> {
        require!(ctx.accounts.authority.key() == ctx.accounts.dex_state.authority, DexError::Unauthorized);
        
        let token_metadata = &mut ctx.accounts.token_metadata;
        token_metadata.is_verified = true;

        msg!("Token verified: {}", token_metadata.symbol);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeDex<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 16 + 8,
    )]
    pub dex_state: Account<'info, DexState>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct DeployToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = authority,
        mint::freeze_authority = authority,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 1 + 8 + 8 + 32 + 8 + 256 + 512 + 8 + 1 + 1 + 8 + 8,
    )]
    pub token_metadata: Account<'info, TokenMetadata>,
    #[account(mut)]
    pub dex_state: Account<'info, DexState>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintInitialSupply<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub token_metadata: Account<'info, TokenMetadata>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ExecuteAutoBurn<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub token_metadata: Account<'info, TokenMetadata>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreatePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 32 + 2 + 32 + 8 + 8 + 8 + 32 + 8 + 16 + 16 + 8,
    )]
    pub pool: Account<'info, PoolAccount>,
    pub token_a: Account<'info, Mint>,
    pub token_b: Account<'info, Mint>,
    pub token_a_account: Account<'info, TokenAccount>,
    pub token_b_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub dex_state: Account<'info, DexState>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AddLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, PoolAccount>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8,
    )]
    pub transaction: Account<'info, Transaction>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, PoolAccount>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8,
    )]
    pub transaction: Account<'info, Transaction>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Swap<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub pool: Account<'info, PoolAccount>,
    #[account(mut)]
    pub dex_state: Account<'info, DexState>,
    pub token_in: Account<'info, Mint>,
    pub token_out: Account<'info, Mint>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 8 + 8 + 8 + 8,
    )]
    pub transaction: Account<'info, Transaction>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdateTokenMetadata<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub token_metadata: Account<'info, TokenMetadata>,
}

#[derive(Accounts)]
pub struct RecordHolder<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub token_metadata: Account<'info, TokenMetadata>,
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 8,
    )]
    pub holder_record: Account<'info, HolderRecord>,
    pub holder: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct VerifyToken<'info> {
    pub authority: Signer<'info>,
    #[account(mut)]
    pub token_metadata: Account<'info, TokenMetadata>,
    pub dex_state: Account<'info, DexState>,
}

#[account]
pub struct DexState {
    pub authority: Pubkey,
    pub token_count: u64,
    pub pool_count: u64,
    pub total_volume: u128,
    pub creation_timestamp: i64,
}

#[account]
pub struct TokenMetadata {
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub total_supply: u64,
    pub circulating_supply: u64,
    pub creator: Pubkey,
    pub creation_timestamp: i64,
    pub logo_uri: String,
    pub description: String,
    pub holders_count: u64,
    pub is_verified: bool,
    pub auto_burn_enabled: bool,
    pub auto_burn_end_timestamp: i64,
    pub burned_amount: u64,
}

#[account]
pub struct PoolAccount {
    pub token_a: Pubkey,
    pub token_b: Pubkey,
    pub token_a_account: Pubkey,
    pub token_b_account: Pubkey,
    pub fee_bps: u16,
    pub authority: Pubkey,
    pub total_liquidity: u64,
    pub reserve_a: u64,
    pub reserve_b: u64,
    pub creator: Pubkey,
    pub creation_timestamp: i64,
    pub total_volume: u128,
    pub total_fees_collected: u128,
    pub lp_token_supply: u64,
}

#[account]
pub struct Transaction {
    pub pool: Pubkey,
    pub user: Pubkey,
    pub tx_type: TransactionType,
    pub amount_a: u64,
    pub amount_b: u64,
    pub fee: u64,
    pub timestamp: i64,
}

#[account]
pub struct HolderRecord {
    pub token_mint: Pubkey,
    pub holder: Pubkey,
    pub balance: u64,
    pub first_seen: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TransactionType {
    AddLiquidity,
    RemoveLiquidity,
    Swap,
}

#[error_code]
pub enum DexError {
    #[msg("Invalid fee (must be 0-500 BPS)")]
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
    #[msg("Name too long")]
    NameTooLong,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Burn disabled")]
    BurnDisabled,
    #[msg("Burn period ended")]
    BurnPeriodEnded,
    #[msg("Invalid burn amount")]
    InvalidBurnAmount,
    #[msg("Exceeds max supply")]
    ExceedsMaxSupply,
    #[msg("Insufficient supply")]
    InsufficientSupply,
    #[msg("Data too large")]
    DataTooLarge,
}
