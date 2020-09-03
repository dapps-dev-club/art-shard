pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";

contract ArtShard is
  ERC1155,
  ERC1155Holder
{

  struct ArtUnderwrite {
    address account;
    uint16 quantity;
  }

  struct Art {
    bytes32 uri;
    uint256 unitPrice;
    uint256 unitPriceTokenId;
    uint256 unitCommission;
    uint16 unitsTotal;
    uint16 unitsUnderwritten;
    address artist;
    uint8 underwriterCount;
    bool isAvailable;
    // underwriter account to units underwritten
    // by that account
    mapping(uint8 => ArtUnderwrite) underwriters;
  }

  uint256 public constant ART_DENARIUS = 0;
  uint256 public constant NON_FUNGIBLE_INDEX = 256;
  mapping(uint256 => Art) public arts;
  uint256 public artIdx = NON_FUNGIBLE_INDEX;

  constructor()
    // TODO this is a placeholder URL
    ERC1155("https://art.shard/api/item/{1}.json")
    public
  {
    _mint(msg.sender, ART_DENARIUS, 10**36, "");
  }

  function produceArt(
    bytes32 uri,
    uint256 unitPrice,
    uint256 unitPriceTokenId,
    uint256 unitCommission,
    uint16 unitsTotal,
    uint16 unitsArtistStake
  )
    external
    returns(uint256 artId)
  {
    // check that amount equals units price * units staked
    //TODO

    // check that other attributes are within range
    //TODO

    // create new art object, and insert artist as
    // first underwriter
    // and increment counter
    artId = ++artIdx;
    Art memory newArt = Art(
      uri,
      unitPrice,
      unitPriceTokenId,
      unitCommission,
      unitsTotal,
      unitsArtistStake, // unitsUnderwritten
      msg.sender, // artist
      1, // underwriterCount
      false // isAvailable
    );

    // store Art object in mapping
    arts[artId] = newArt;
    arts[artId].underwriters[1] = ArtUnderwrite(
      msg.sender, // address account
      unitsArtistStake // uint16 quantity
    );

    // Accounting and transfers for balance increment
    // TODO

    // NOTE this relies on a patch to the underlying ERC1155
    // implementation which allows an account to approve
    // the smart contract to transfer tokens irrespective
    // of message sender
    // Ref: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/2346
    setApprovalForAll(
      address(this), // address operator,
      true // bool approved
    );

    // Emit event
    //TODO
  }

  function underwriteArt(
    uint256 artId,
    uint16 unitsUnderwritten
  )
    external
  {
    // check that art is not already underwritten
    //TODO

    // check that new unit number will not exceed units total
    //TODO

    // check that amount equals units price *
    // units underwritten
    //TODO

    // if msgSender is already an underwriter,
    // increment units value in underwriters mapping
    // else insert new value of units in underwriters mapping
    arts[artId].underwriterCount++;
    arts[artId].underwriters[arts[artId].underwriterCount] = ArtUnderwrite(
      msg.sender,
      unitsUnderwritten
    );
    // ArtUnderwrite memory artUnderWrite =
    //   arts[artId].underwriters[arts[artId].underwriterCount];
    // uint16 units = arts[artId].underwriters[msg.sender];
    // arts[artId].underwriters[msg.sender] = units + unitsUnderwritten;

    // if total units have been reached indicate
    arts[artId].unitsUnderwritten =
      arts[artId].unitsUnderwritten + unitsUnderwritten;

    arts[artId].isAvailable =
      (arts[artId].unitsUnderwritten ==
      arts[artId].unitsTotal);

    // Accounting and transfers for balance increment
    // TODO

    // Emit event
    //TODO

    if (arts[artId].isAvailable) {
      // Emit event
      //TODO

      // Mint
      // NOTE artists holds all the tokens, not underwriter.
      // But artist has already pre-approved this smart contract
      // as able to operate its tokens.
      _mint(
        arts[artId].artist, // address(this),
        artId,
        arts[artId].unitsTotal,
        ""
      );
    }
  }

  // Special getter
  function getArtUnderwriter(
    uint256 artId,
    uint8 underwriteId
  )
    public
    view
    returns (
      address account,
      uint16 quantity
    )
  {
    ArtUnderwrite memory underwrite =
      arts[artId].underwriters[underwriteId];
    return (underwrite.account, underwrite.quantity);
  }

  function buyArt(
    uint256 artId,
    uint16 units,
    address seller
  )
    external
  {
    // Ensure that smart contract is approved to send NFT
    // TODO

    Art memory art = arts[artId];

    // Ensure that buyer has enough to pay for commissions
    uint256 totalCommission = art.unitCommission
      .mul(units);
    require(
      balanceOf(msg.sender, art.unitPriceTokenId) >= totalCommission,
      "ArtShard: Not enough FT balance to pay commissions for NFT transfer"
    );

    // Transfer the NFT to buyer
    // (this smart contract already should have approval)
    // NOTE this relies on a patch to the underlying ERC1155
    // implementation which allows an account to approve
    // the smart contract to transfer tokens irrespective
    // of message sender
    // Ref: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/2346
    safeTransferFrom(
      seller, // address from,
      msg.sender, // address to,
      artId, // uint256 id,
      units, // uint256 amount,
      "" // bytes memory data
    );

    // Transfer the price less commissions in FT to seller
    uint256 sellerReceiveAmount = art
      .unitPrice.mul(units)
      .sub(totalCommission);
    safeTransferFrom(
      msg.sender, // address from,
      seller, // address to,
      art.unitPriceTokenId, // uint256 id,
      sellerReceiveAmount, // uint256 amount,
      "" // bytes memory data
    );

    // Transfer share of commissions in FT to each underwriter
    for (uint8 ui = 1; ui <= art.underwriterCount; ui++) {
      ArtUnderwrite memory artUnderwrite =
        arts[artId].underwriters[ui];
      uint256 underwriterCommission = totalCommission
        .mul(artUnderwrite.quantity)
        .div(art.unitsTotal);
      safeTransferFrom(
        msg.sender, // address from,
        artUnderwrite.account, // address to,
        art.unitPriceTokenId, // uint256 id,
        underwriterCommission, // uint256 amount,
        "" // bytes memory data
      );
    }
  }

}
