use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount};

declare_id!("Fg1s6RyhV1otJ6M862xiTNy9D292haSM1YMtn6RcoMWb");

pub const PLATFORM_FEE_BPS: u16 = 1; // 0.01%
pub const FEE_RECIPIENT: &str = "F9RJSJ4Fr2mLsQrZjemeg3PVMjG2KgjF9t5shZLHMnwG";

#[program]
pub mod max_router {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let router = &mut ctx.accounts.router;
        router.owner = ctx.accounts.owner.key();
        router.fee_bps = PLATFORM_FEE_BPS;
        router.treasury = Pubkey::from_str(FEE_RECIPIENT).unwrap();
        router.total_volume = 0;
        router.total_fees = 0;
        router.nonce = 0;
        msg!("MAX Router initialized with 0.01% fee");
        msg!("Treasury: {}", router.treasury);
        Ok(())
    }

    pub fn execute_swap(
        ctx: Context<ExecuteSwap>,
        amount_in: u64,
        min_amount_out: u64,
    ) -> Result<()> {
        let router = &mut ctx.accounts.router;
        
        // Calculate 0.01% fee
        let fee = (amount_in as u128 * PLATFORM_FEE_BPS as u128 / 10000) as u64;
        let amount_to_swap = amount_in - fee;
        
        // Transfer fee to treasury
        if fee > 0 {
            let cpi_ctx = CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_source_token.to_account_info(),
                    to: ctx.accounts.treasury_token.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            );
            token::transfer(cpi_ctx, fee)?;
            msg!("Fee collected: {} lamports", fee);
        }
        
        msg!("Swap executed: amount_in={}, fee={}, amount_to_swap={}", 
             amount_in, fee, amount_to_swap);
        
        // Update router stats
        router.total_volume += amount_in;
        router.total_fees += fee;
        router.nonce += 1;
        
        Ok(())
    }

    pub fn get_quote(_ctx: Context<GetQuote>, amount_in: u64) -> Result<QuoteResult> {
        let fee = (amount_in as u128 * PLATFORM_FEE_BPS as u128 / 10000) as u64;
        let amount_out = amount_in - fee;
        
        Ok(QuoteResult {
            amount_in,
            fee,
            amount_out,
            fee_bps: PLATFORM_FEE_BPS,
        })
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = owner, space = 8 + 32 + 2 + 32 + 16 + 16 + 8)]
    pub router: Account<'info, RouterState>,
    #[account(mut)]
    pub owner: Signer<'info>,
    /// CHECK: Treasury wallet for fees
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteSwap<'info> {
    #[account(mut)]
    pub router: Account<'info, RouterState>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_source_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub user_destination_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub treasury_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GetQuote<'info> {
    pub router: Account<'info, RouterState>,
}

#[account]
pub struct RouterState {
    pub owner: Pubkey,
    pub fee_bps: u16,
    pub treasury: Pubkey,
    pub total_volume: u64,
    pub total_fees: u64,
    pub nonce: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct QuoteResult {
    pub amount_in: u64,
    pub fee: u64,
    pub amount_out: u64,
    pub fee_bps: u16,
}
