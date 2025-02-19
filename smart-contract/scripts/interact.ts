import { ethers } from "hardhat";

const TEST_TOKEN_ADDRESS = "0xC8F9e4EFa90290bADF6032dFd4e3773576CD48b1";
const AUCTION_ADDRESS = "0x07b4051221388Cf007438Fb54B1b0b7ff85cA2d9";

const TOKEN_AMOUNT = ethers.parseEther("0.1");     
const START_PRICE = ethers.parseEther("0.001");    
const END_PRICE = ethers.parseEther("0.0001");     
const DURATION = 300;                              

async function simulateAuction() {
  console.log("\n=== Starting Auction Simulation ===");

  try {
    const [signer] = await ethers.getSigners();
    console.log("Signer address:", signer.address);
    
    const balance = await ethers.provider.getBalance(signer.address);
    console.log("ETH Balance:", ethers.formatEther(balance), "ETH");

    const testToken = await ethers.getContractAt("TestToken", TEST_TOKEN_ADDRESS);
    const auction = await ethers.getContractAt("ReverseDutchAuctionSwap", AUCTION_ADDRESS);

    console.log("\nChecking token balance...");
    const initialBalance = await testToken.balanceOf(signer.address);
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
    const currentPrice = await auction.getCurrentPrice(auctionId);
    console.log("\nCurrent price:", ethers.formatEther(currentPrice), "ETH");

    console.log("\nExecuting swap...");
    const swapTx = await auction.executeSwap(auctionId, {
      value: currentPrice,
      gasLimit: 200000  
    });
    await swapTx.wait();

    const finalBalance = await testToken.balanceOf(signer.address);
    console.log("\nFinal token balance:", ethers.formatEther(finalBalance));

  } catch (error) {
    console.error("Error in simulateAuction:", error);
    throw error;
  }
}

async function checkPriceIntervals() {
  console.log("\n=== Checking Price Intervals ===");
  
  try {
    const [signer] = await ethers.getSigners();
    
    const testToken = await ethers.getContractAt("TestToken", TEST_TOKEN_ADDRESS);
    const auction = await ethers.getContractAt("ReverseDutchAuctionSwap", AUCTION_ADDRESS);

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
    const auctionId = Number(await auction.getAuctionCount()) - 1;

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