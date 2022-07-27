// SPDX-License-Identifier: MIT

// IV is value needed to have a vanity address starting with '0x1820'.
// IV: 53759

/// @dev The interface a contract MUST implement if it is the implementer of
/// some (other) interface for any address other than itself.
interface IERC1820Implementer {
    /// @notice Indicates whether the contract implements the interface 'interfaceHash' for the address 'addr' or not.
    /// @param interfaceHash keccak256 hash of the name of the interface
    /// @param addr Address for which the contract will implement the interface
    /// @return ERC1820_ACCEPT_MAGIC only if the contract implements 'interfaceHash' for the address 'addr'.
    function canImplementInterfaceForAddress(
        bytes32 interfaceHash,
        address addr
    ) external view returns (bytes32);
}
