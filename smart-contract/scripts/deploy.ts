import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const TEST_TOKEN_ADDRESS = "0xD57A482ed1D4C11f14438a31F64fC8E27F897b74";
const AUCTION_ADDRESS = "0xbE51d2F0037f58901568BfF43c6b56726e246141";


const TOKEN_AMOUNT = ethers.parseEther("100");  
const START_PRICE = ethers.parseEther("1");     
const END_PRICE = ethers.parseEther("0.1");    
const DURATION = 300;                           

async function simulateAuction() {
  console.log("\n=== Starting Auction Simulation ===");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.LISK_SEPOLIA_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
    
    console.log("Signer address:", wallet.address);
  
    const testToken = await ethers.getContractAt("TestToken", TEST_TOKEN_ADDRESS, wallet);
    const auction = await ethers.getContractAt("ReverseDutchAuctionSwap", AUCTION_ADDRESS, wallet);

    console.log("\nChecking token balance...");
    const initialBalance = await testToken.balanceOf(wallet.address);
    console.log("Initial token balance:", ethers.formatEther(initialBalance));

    console.log("\nApproving auction contract...");
    const approveTx = await testToken.approve(auction.target, TOKEN_AMOUNT);
    await approveTx.wait();
    console.log("Approval completed");

    console.log("\nCreating auction...");
    const createTx = await auction.createAuction(
      testToken.target,
      TOKEN_AMOUNT,
      START_PRICE,
      END_PRICE,
      DURATION
    );
    await createTx.wait();
    console.log("Auction created");

    const auctionId = 0;
    const initialPrice = await auction.getCurrentPrice(auctionId);
    console.log("\nInitial price:", ethers.formatEther(initialPrice), "ETH");

    console.log("\nWaiting for 1 minute...");
    await time.increase(60);

    const midPrice = await auction.getCurrentPrice(auctionId);
    console.log("Current price:", ethers.formatEther(midPrice), "ETH");

    console.log("\nExecuting swap...");
    const swapTx = await auction.executeSwap(auctionId, {
      value: midPrice
    });
    await swapTx.wait();

    const finalBalance = await testToken.balanceOf(wallet.address);
    console.log("\nFinal token balance:", ethers.formatEther(finalBalance));

  } catch (error) {
    console.error("Error in simulateAuction:", error);
    throw error;
  }
}

async function checkPriceIntervals() {
  console.log("\n=== Checking Price Intervals ===");
  
  try {
    const provider = new ethers.JsonRpcProvider(process.env.LISK_SEPOLIA_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || "", provider);
    
    const testToken = await ethers.getContractAt("TestToken", TEST_TOKEN_ADDRESS, wallet);
    const auction = await ethers.getContractAt("ReverseDutchAuctionSwap", AUCTION_ADDRESS, wallet);

    console.log("\nSetting up new auction...");
    await testToken.approve(auction.target, TOKEN_AMOUNT);
    await auction.createAuction(
      testToken.target,
      TOKEN_AMOUNT,
      START_PRICE,
      END_PRICE,
      DURATION
    );

    const timeIntervals = [0, 60, 120, 180, 240, 300]; 
    const auctionId = await auction.getAuctionCount() - 1;

    console.log("\nPrice changes over time:");
    console.log("------------------------");

    for (const interval of timeIntervals) {
      const currentPrice = await auction.getCurrentPrice(auctionId);
      console.log(
        `Time: ${interval / 60} minutes, Price: ${ethers.formatEther(currentPrice)} ETH`
      );
      if (interval < timeIntervals[timeIntervals.length - 1]) {
        await time.increase(60); 
      }
    }
  } catch (error) {
    console.error("Error in checkPriceIntervals:", error);
    throw error;
  }
}

async function main() {
  try {
    await simulateAuction();
    
    await checkPriceIntervals();
    
    console.log("\n=== All simulations completed successfully ===");
  } catch (error) {
    console.error("Error during simulation:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });