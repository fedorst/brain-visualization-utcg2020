"""

Prepare the data matrices for visualization:

    neural_responses_ctg_lfp.npy   [8 x 11293 x 48] (float)   image-timebin-average-raw voltage responses (baseline subtracted) [category x probe x time]
    neural_responses_all_lfp.npy   [11293 x 48] (float)       category-timebin-average-raw voltage responses (baseline subtracted) [probe x time]
    categories.npy                 [8]              (str)     names of the categories [category]
    mni_coordinates.npy            [11293 x 3]      (float)   probe implantation sites in MNI space [probes x (x,y,z)]

    TODO:
    predictive.npy                 [11293 x 8]      (int)     1 if a probe is predictive of a category, 0 otherwise [probes x categories]
    neural_responses_ctg_frq.npy   [8 x 11293 x 48] (float)   image-timebit-average frequecy power responses log(signal/baseline) [category x probe x time]
    neural_responses_all_frq.npy   [8 x 11293 x 48] (float)   category-timebit-average frequecy power responses log(signal/baseline) [category x probe x time]
    complexity_colors.npy          [11293 x 3]                probe colors according to representational comlexity (DCNN-based) [probe x rgb]

Run with Python 2.7

"""

import os
import natsort
import numpy as np
import scipy.io as sio
from shutil import copyfile



#
#  Parameters
#
ORGDATA = '../../Data/Raw'
PRCDATA = '../../Data/Intracranial Decoding/Processed'
OUTDATA = '../../Outcome'
FEATURESET = 'subtract_baseline_ft_4hz150_LFP_8c_artif_bipolar_BA_responsive'

'''
H = house            10 [0]
V = visage           20 [1]
AA = animal          30 [2]
SCEE = scene         40 [3]
T = tool             50 [4]
tambulo = pseudoword 60 [5]
hgfjh = characters   70 [6]
F = target fruit     80 --- excluded from the analysis
SCR = scrambled      90 [7]
'''
keep_groups = [10, 20, 30, 40, 50, 60, 70, 90]



#
#  Stimuli
#

# subselect stimuli based on the category
stim_groups = np.loadtxt('%s/stimgroups401.txt' % ORGDATA, dtype=np.int)
keep_stimuli_idx = np.isin(stim_groups, keep_groups)

# save the new list of stimulus groups
out_stim_groups = stim_groups[keep_stimuli_idx]
n_stimuli = len(out_stim_groups)
#np.save('%s/stimgroups.npy' % OUTDATA, out_stim_groups)

# save the new list of stimuli
#stim_sequence = np.genfromtxt('%s/stimsequence401.txt' % ORGDATA, dtype='str')
#out_stim_sequence = stim_sequence[keep_stimuli_idx]
#np.save('%s/stimsequence.npy' % OUTDATA, out_stim_sequence)

# copy relevant stimulus images
#for s in out_stim_sequence:
#    copyfile('%s/VISU_stimuli/%s.jpg' % (ORGDATA, s), '%s/stimuli/%s.jpg' % (OUTDATA, s))



#
#  Assemble the data
#
probefiles = natsort.natsorted(os.listdir('%s/%s' % (PRCDATA, FEATURESET)))
n_probes = len(probefiles)
n_timebins = 48
out_neural_responses_ctg_lfp = np.zeros((8, n_probes, n_timebins), dtype=np.float16)
out_neural_responses_all_lfp = np.zeros((n_probes, n_timebins), dtype=np.float16)
mni_coordinates = np.zeros((n_probes, 3), dtype=np.float16)
#brodmann_areas = np.zeros(n_probes, dtype=np.int)
#subject_ids = []

for i, pf in enumerate(probefiles):
    if i % 10 == 0:
        print('%d / %d' % (i, n_probes))

    # Load LFP responses
    sname = pf.replace('.npy', '')
    (sname, pid) = sname.split('-')
    s = sio.loadmat('%s/LFP_8c_artif_bipolar_BA_responsive/%s.mat' % (PRCDATA, sname))

    # LFP time binning
    lfp_bins = np.split(s['s']['data'][0][0][keep_stimuli_idx, :, :], 48, axis=2)
    lfp = np.zeros((lfp_bins[0].shape[0], lfp_bins[0].shape[1], len(lfp_bins)))
    for b, bin in enumerate(lfp_bins):
        lfp[:, :, b] = np.mean(bin, axis=2)

    # subtract average baseline
    normalizer = np.mean(lfp[:, :, 0:14], axis=2)
    normalizer = np.repeat(normalizer[:, :, np.newaxis], 48, axis=2)
    lfp = lfp - normalizer

    # yes, it is very inefficient to take only 1 probe's data per iteration, deal with it later

    # LFP category binning
    out_neural_responses_all_lfp[i, :] = np.mean(lfp, axis=0)[int(pid) - 1, :]  # all
    out_neural_responses_ctg_lfp[0, i, :] = np.mean(lfp[stim_groups == 10, int(pid) - 1, :], axis=0)  # house
    out_neural_responses_ctg_lfp[1, i, :] = np.mean(lfp[stim_groups == 20, int(pid) - 1, :], axis=0)  # face
    out_neural_responses_ctg_lfp[2, i, :] = np.mean(lfp[stim_groups == 30, int(pid) - 1, :], axis=0)  # animal
    out_neural_responses_ctg_lfp[3, i, :] = np.mean(lfp[stim_groups == 40, int(pid) - 1, :], axis=0)  # scene
    out_neural_responses_ctg_lfp[4, i, :] = np.mean(lfp[stim_groups == 50, int(pid) - 1, :], axis=0)  # tool
    out_neural_responses_ctg_lfp[5, i, :] = np.mean(lfp[stim_groups == 60, int(pid) - 1, :], axis=0)  # pseudoword
    out_neural_responses_ctg_lfp[6, i, :] = np.mean(lfp[stim_groups == 70, int(pid) - 1, :], axis=0)  # characters
    out_neural_responses_ctg_lfp[7, i, :] = np.mean(lfp[stim_groups == 90, int(pid) - 1, :], axis=0)  # noise

    # Brodmann areas
    #areas = s['s']['probes'][0][0][0][0][3]
    #brodmann_areas[i] = areas[int(pid) - 1]

    # MNI coordniates
    mnis  = s['s']['probes'][0][0][0][0][2]
    mni_coordinates[i] = mnis[int(pid) - 1]

    # Subject ID
    #subject_ids.append(sname)

    # ft data
    #ft = np.load('%s/%s/%s' % (PRCDATA, FEATURESET, pf))
    #out_ft = ft[keep_stimuli_idx, 66:, :]
    #out_neural_responses[:, i, :] = np.mean(out_ft, axis=1)

np.save('%s/neural_responses_ctg_lfp.npy' % OUTDATA, out_neural_responses_ctg_lfp)
np.save('%s/neural_responses_all_lfp.npy' % OUTDATA, out_neural_responses_all_lfp)
#np.save('%s/brodmann_areas.npy' % OUTDATA, brodmann_areas)
np.save('%s/mni_coordinates.npy' % OUTDATA, mni_coordinates)
#np.save('%s/subject_ids.npy' % OUTDATA, np.array(subject_ids))
np.save('%s/categories.npy' % OUTDATA, np.array(['house', 'face', 'animal', 'scene', 'tool', 'pseudoword', 'characters', 'noise']))


#
#  Reference
#

# Splitting into 48 time bins, 31.25 ms each
'''
ft   lfp    ms
--   ---  ----
 0     0  -500
 1    16  -469
 2    32  -438
 3    48  -406
 4    64  -375
 5    80  -344
 6    96  -312
 7   112  -281
 8   128  -250
 9   144  -219
10   160  -188
11   176  -156
12   192  -125
13   208   -94
14   224   -62
15   240   -31
16   256     0
17   272    31
18   288    62
19   304    94
20   320   125
21   336   156
22   352   188
23   368   219
24   384   250
25   400   281
26   416   312
27   432   344
28   448   375
29   464   406
30   480   438
31   496   469
32   512   500
33   528   531
34   544   562
35   560   594
36   576   625
37   592   656
38   608   688
39   624   719
40   640   750
41   656   781
42   672   812
43   688   844
44   704   875
45   720   906
46   736   938
47   752   969
'''
