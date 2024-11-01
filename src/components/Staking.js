import React, { useState, useEffect } from 'react';
import './Staking.css';
import { ethers } from 'ethers';

// Configuration du contrat avec ABI mis à jour sans lock period
const PROXY_ADDRESS = "0xeBaFE97112C5008249fb6fF4bCAf0a603d39e2a7";
const CONTRACT_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function getStakeInfo(address) view returns (uint256 stakedAmount, uint256 pendingRewards, uint256 contractBalance, uint256 rewardsPool)",
    "function BASE_APY() view returns (uint256)",
    "function stakingBurnRate() view returns (uint256)",
    "function standardBurnRate() view returns (uint256)",
    "function isExcludedFromTxLimit(address) view returns (bool)",
    
    "function approve(address spender, uint256 amount) returns (bool)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function transferFrom(address from, address to, uint256 amount) returns (bool)",
    "function stake(uint256 amount) external",
    "function unstake(uint256) external",
    "function claimRewards() external"
];

const Notification = ({ message, type, onClose }) => (
    <div className={`notification ${type}`}>
        {message}
        <button className="notification-close" onClick={onClose}>&times;</button>
    </div>
);

const ConfirmationModal = ({ onConfirm, onCancel, message }) => (
    <div className="modal-overlay">
        <div className="modal-content">
            <h3>Confirmation</h3>
            <p>{message}</p>
            <div className="modal-buttons">
                <button className="modal-button confirm" onClick={onConfirm}>Confirmer</button>
                <button className="modal-button cancel" onClick={onCancel}>Annuler</button>
            </div>
        </div>
    </div>
);

function Staking() {
    const [userAddress, setUserAddress] = useState(null);
    const [provider, setProvider] = useState(null);
    const [contract, setContract] = useState(null);
    const [error, setError] = useState(null);
    const [balance, setBalance] = useState('0');
    const [stakedAmount, setStakedAmount] = useState('0');
    const [pendingRewards, setPendingRewards] = useState('0');
    const [baseAPY] = useState('20.00');
    const [stakeAmount, setStakeAmount] = useState('');
    const [unstakeAmount, setUnstakeAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [notification, setNotification] = useState(null);
    const [networkName, setNetworkName] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationConfig, setConfirmationConfig] = useState({});
    const [progress, setProgress] = useState(0); // Ajout de la progression de staking
    const [isStaking, setIsStaking] = useState(false); // Indicateur de staking en cours

    const showNotification = (message, type = 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };

    const updateUserData = async (contract, address) => {
        try {
            const balance = await contract.balanceOf(address);
            const stakeInfo = await contract.getStakeInfo(address);

            setBalance(ethers.utils.formatEther(balance));
            setStakedAmount(ethers.utils.formatEther(stakeInfo.stakedAmount));
            setPendingRewards(ethers.utils.formatEther(stakeInfo.pendingRewards));
        } catch (error) {
            console.error("Erreur lors de la mise à jour des données:", error);
            showNotification("Erreur lors de la mise à jour des données", "error");
        }
    };

    const handleConnectWallet = async () => {
        try {
            setError(null);
            if (!window.ethereum) {
                throw new Error("MetaMask n'est pas installé");
            }

            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = provider.getSigner();
            const address = await signer.getAddress();
            
            const network = await provider.getNetwork();
            if (network.chainId !== 11155111) {
                throw new Error("Veuillez vous connecter au réseau Sepolia");
            }
            setNetworkName("Testnet Sepolia");
            
            const contract = new ethers.Contract(PROXY_ADDRESS, CONTRACT_ABI, signer);
            
            setProvider(provider);
            setContract(contract);
            setUserAddress(address);

            await updateUserData(contract, address);
            showNotification("Wallet connecté avec succès", "success");
        } catch (error) {
            console.error("Erreur lors de la connexion:", error);
            setError(error.message);
            showNotification(error.message, "error");
        }
    };

    const handleStake = async () => {
        if (!contract || !stakeAmount) return;

        setConfirmationConfig({
            message: `Êtes-vous sûr de vouloir staker ${stakeAmount} $GR33D ?`,
            onConfirm: async () => {
                setIsLoading(true);
                setIsStaking(true); // Active la barre de progression
                setProgress(0); // Réinitialise la barre de progression
                setError(null);
                try {
                    const amount = ethers.utils.parseEther(stakeAmount);
                    const tx = await contract.stake(amount);

                    // Simulation de progression de la barre
                    const interval = setInterval(() => {
                        setProgress(prev => {
                            if (prev >= 100) {
                                clearInterval(interval);
                                return 100;
                            }
                            return prev + 10;
                        });
                    }, 300);

                    showNotification("Transaction en cours...", "info");
                    await tx.wait();
                    await updateUserData(contract, userAddress);
                    setStakeAmount('');
                    showNotification("Staking effectué avec succès!", "success");
                } catch (error) {
                    setError("Erreur lors du staking: " + error.message);
                    showNotification("Erreur lors du staking", "error");
                } finally {
                    setIsLoading(false);
                    setIsStaking(false); // Désactive la barre de progression
                }
            }
        });
        setShowConfirmation(true);
    };

    const handleUnstake = async () => {
        if (!contract || !unstakeAmount) return;
        
        setConfirmationConfig({
            message: `Êtes-vous sûr de vouloir unstaker ${unstakeAmount} $GR33D ?`,
            onConfirm: async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const amount = ethers.utils.parseEther(unstakeAmount);
                    const tx = await contract.unstake(amount);
                    showNotification("Transaction en cours...", "info");
                    await tx.wait();
                    await updateUserData(contract, userAddress);
                    setUnstakeAmount('');
                    showNotification("Unstaking effectué avec succès!", "success");
                } catch (error) {
                    setError("Erreur lors de l'unstaking: " + error.message);
                    showNotification("Erreur lors de l'unstaking", "error");
                } finally {
                    setIsLoading(false);
                }
            }
        });
        setShowConfirmation(true);
    };

    const handleClaimRewards = async () => {
        if (!contract) return;
        
        setConfirmationConfig({
            message: `Voulez-vous réclamer ${pendingRewards} $GR33D de récompenses ?`,
            onConfirm: async () => {
                setIsLoading(true);
                setError(null);
                try {
                    const tx = await contract.claimRewards();
                    showNotification("Transaction en cours...", "info");
                    await tx.wait();
                    await updateUserData(contract, userAddress);
                    showNotification("Récompenses réclamées avec succès!", "success");
                } catch (error) {
                    setError("Erreur lors de la réclamation des récompenses: " + error.message);
                    showNotification("Erreur lors de la réclamation", "error");
                } finally {
                    setIsLoading(false);
                }
            }
        });
        setShowConfirmation(true);
    };

    useEffect(() => {
        if (contract && userAddress) {
            const interval = setInterval(() => {
                updateUserData(contract, userAddress);
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [contract, userAddress]);

    useEffect(() => {
        if (window.ethereum) {
            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });
            window.ethereum.on('accountsChanged', () => {
                window.location.reload();
            });
        }
    }, []);

    return (
        <div className="staking-section">
            {networkName && (
                <div className="network-banner">
                    Réseau actuel : {networkName}
                </div>
            )}

            {notification && (
                <Notification
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}

            {showConfirmation && (
                <ConfirmationModal
                    message={confirmationConfig.message}
                    onConfirm={async () => {
                        setShowConfirmation(false);
                        await confirmationConfig.onConfirm();
                    }}
                    onCancel={() => setShowConfirmation(false)}
                />
            )}

            <div className="instruction-box">
                <p>Pour une connexion optimale avec MetaMask, veuillez désactiver temporairement 
                   les autres extensions Web3 si MetaMask ne s'ouvre pas comme prévu.</p>
            </div>

            {error && <div className="error-message">{error}</div>}

            {!userAddress ? (
                <button className="connect-button" onClick={handleConnectWallet}>
                    Connecter
                </button>
            ) : (
                <div className="staking-container">
                    <div className="staking-card wallet-info">
                        <h3>Informations Wallet</h3>
                        <p>Adresse: {userAddress}</p>
                        <p>Balance: {balance} $GR33D</p>
                    </div>

                    <div className="staking-card staking-info">
                        <h3>Informations Staking</h3>
                        <p>Montant Staké: {stakedAmount} $GR33D</p>
                        <p>Récompenses en attente: {pendingRewards} $GR33D</p>
                        <p>APY Base: {baseAPY}%</p>
                    </div>

                    <div className="staking-card staking-actions">
                        <h3>Staking</h3>
                        <div className="input-group">
                            <input
                                type="number"
                                className="staking-input"
                                placeholder="Montant à staker"
                                value={stakeAmount}
                                onChange={(e) => setStakeAmount(e.target.value)}
                            />
                            <button 
                                className={`staking-button ${isLoading ? 'loading' : ''}`}
                                onClick={handleStake}
                                disabled={isLoading || !stakeAmount}
                            >
                                Stake
                            </button>
                        </div>
                        {isStaking && (
                            <div className="progress-bar-container">
                                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                            </div>
                        )}
                    </div>

                    <div className="staking-card unstaking-actions">
                        <h3>Unstaking</h3>
                        <div className="input-group">
                            <input
                                type="number"
                                className="staking-input"
                                placeholder="Montant à unstaker"
                                value={unstakeAmount}
                                onChange={(e) => setUnstakeAmount(e.target.value)}
                            />
                            <button 
                                className={`staking-button ${isLoading ? 'loading' : ''}`}
                                onClick={handleUnstake}
                                disabled={isLoading || !unstakeAmount}
                            >
                                Unstake
                            </button>
                        </div>
                    </div>

                    <div className="staking-card rewards-actions">
                        <h3>Récompenses</h3>
                        <button 
                            className={`staking-button claim-button ${isLoading ? 'loading' : ''}`}
                            onClick={handleClaimRewards}
                            disabled={isLoading || parseFloat(pendingRewards) <= 0}
                        >
                            Réclamer {pendingRewards} $GR33D
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Staking;
