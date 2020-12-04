"""

Set of plots to understand the data

"""

import numpy as np
import matplotlib.pyplot as plt

OUTDATA = '../../Outcome'

# LFPs
neural_responses_all_lfp = np.load('../../Outcome/neural_responses_all_lfp.npy')
neural_responses_ctg_lfp = np.load('../../Outcome/neural_responses_ctg_lfp.npy')

plt.hist(neural_responses_all_lfp.flatten(), bins=50);
plt.title("LFP responses averaged over all images");
plt.show();

plt.hist(neural_responses_ctg_lfp.flatten(), bins=50);
plt.title("LFP responses averaged within each image category");
plt.show();

# Frequency powers
neural_responses_all_frq = np.load('../../Outcome/neural_responses_all_frq.npy')
neural_responses_ctg_frq = np.load('../../Outcome/neural_responses_ctg_frq.npy')

plt.hist(neural_responses_all_frq.flatten(), bins=50);
plt.title("High gamma responses averaged over all images");
plt.show();

plt.hist(neural_responses_ctg_frq.flatten(), bins=50);
plt.title("High gamma responses averaged within each image category");
plt.show();
