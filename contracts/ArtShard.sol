pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

contract ArtShard is ERC1155 {

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
      _mint(
        arts[artId].artist,
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

  //Override transfer functions to collect commission
  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  )
    override
    internal
    virtual
  {
    if (from == address(0) || to == address(0)) {
      // we do not need to do anything if this is a mint or burn,
      // only care about transfer from one account to another
      return;
    }

    // TODO check NFT purchase intent of `to` account,
    // since it is transferring FT to the `from` account for commission
    // perhaps use ecrecover to check signed `data`,
    // but in a manner that isn't subject to replayability?
    // Will get this error: "ERC1155: caller is not owner nor approved"
    // Perhaps the workaround is to have a special account,
    // e.g. the owner or the exchange, be aproved to do transfers on both
    // ... but that prevents a fully decentralise solution, and who pays for gas

    for (uint256 i = 0; i < ids.length; i++) {
      uint256 id = ids[i];
      if (id > NON_FUNGIBLE_INDEX) {
        // fungible token transfer is occuring,
        // so need to calculate commission for underwriters
        // and do a batch transfer
        Art memory art = arts[id];

        // Ensure that sender has enough to pay for commissions
        uint256 totalCommission = art.unitCommission.mul(art.unitPrice);
        require(
          balanceOf(from, art.unitPriceTokenId) >= totalCommission,
          "ArtShard: Not enough FT balance to pay commissions for NFT transfer"
        );

        // Transfer to each underwriter
        for (uint8 ui = 0; ui < art.underwriterCount; ui++) {
          ArtUnderwrite memory artUnderwrite = arts[id].underwriters[ui];
          uint256 underwriterCommission = totalCommission
            .mul(artUnderwrite.quantity)
            .div(art.underwriterCount);
          safeTransferFrom(
            operator, // address from,
            artUnderwrite.account, // address to,
            art.unitPriceTokenId, // uint256 id,
            underwriterCommission, // uint256 amount,
            "" // bytes memory data
          );
        }
      }
    }
  }
}
