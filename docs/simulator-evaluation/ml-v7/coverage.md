# Training-label coverage

| Period | Fit chip frauds | Fit online frauds | Fit swipe frauds |
| --- | ---: | ---: | ---: |
| 2016-H1 | 102 | 1035 | 96 |
| 2016-H2 | 84 | 903 | 70 |
| 2017-H1 | 0 | 0 | 0 |
| 2017-H2 | 134 | 0 | 7 |
| 2018-H1 | 656 | 0 | 93 |
| 2018-H2 | 731 | 73 | 78 |

These are eligible positive-purchase labels for the existing fit-role users, independently matched against the original CSV across all 36 role/period/channel groups. Zero labels are a source property, not an extraction discrepancy. The first half of 2017 also has zero frauds for validation users. This audit does not establish whether the synthetic generator intended these patterns or whether its labels are incomplete.

January?June 2018 includes 74,321 online purchases, none labelled fraudulent. More total transaction rows alone therefore does not solve online fraud coverage. Older data contains online positives, but represents a different distribution; any reuse needs time-aware validation and explicit channel reporting.
