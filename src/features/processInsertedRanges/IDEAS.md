# Looking at replacements / deletions

instead of looking at transactions & cases we could look at the deleted range of a step. 
If that range contains a mismatched ZWSP after applying the step pair like:
- zwsp insertion -> block break -> (missing zwsp insertion)
- (missing zwsp insertion) -> block break -> zwsp insertion
- zwsp insertion -> (missing block break) -> zwsp insertion

And we had a correct zwsp pair in that place before then we modify that step
to remove the whole range, containing the zwsp pair & block break.
It might make sense to update the slice if there's content in it. If the replacement contains a
mismatched zwsp pair then we should remove those.
