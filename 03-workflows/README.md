# 03 — Workflows

In Chapter 02 the model decided every step. In a workflow, **your code sets the path** and the model handles each step. When you already know the steps, this is cheaper, faster and much more predictable.

Each file is a standalone pattern. None of them use tools: every step is a single prompt in, text out, using the `ask()` helper in `shared/llm.py`.

## Run them

```bash
python 03-workflows/chaining.py
python 03-workflows/routing.py
python 03-workflows/parallel.py
python 03-workflows/evaluator_optimizer.py
```

## The four patterns

### Chaining: `chaining.py`
```
topic ──▶ outline ──▶ draft ──▶ edit ──▶ final
```
Each step's output is the next step's input. Use it when a task splits naturally into stages.

The edit step also checks the word count in Python and retries if it's over. Rules you can measure should be enforced in code, not just asked for in the prompt.

### Routing: `routing.py`
```
                      ┌─▶ question prompt  ─┐
message ──▶ classify ─┼─▶ complaint prompt ─┼─▶ reply
                      └─▶ feedback prompt  ─┘
```
One cheap call picks a category, then your code chooses the specialised prompt. Use it when inputs need different handling.

### Parallelisation: `parallel.py`
```
        ┌─▶ clarity  ─┐
text ───┼─▶ tone     ─┼─▶ merge ──▶ review
        └─▶ accuracy ─┘
```
Independent calls run at the same time, then get combined. Use it to speed things up or to get several focused perspectives.

### Evaluator-optimiser: `evaluator_optimizer.py`
```
write ──▶ grade ──PASS──▶ done
            │
          fixes
            ▼
         revise ──▶ grade ...
```
One call writes, another grades against clear criteria, and the writer revises. Use it when quality can be checked against specific rules.

## Why workflows

- **Errors compound in agents.** If each step is 95% reliable, ten model-chosen steps succeed only about 60% of the time. In a workflow the path is fixed, so only the content of each step can go wrong.
- **Small prompts beat big ones.** One job per call is easier for the model and easier for you to debug.
- **Force simple outputs.** Asking for one word or `PASS` means plain Python can branch on the result.
- **Always have a fallback and a cap.** Models sometimes go off-script, so routing has a default and the evaluator loop has `max_rounds`.

## Agent or workflow?

| Use a workflow when... | Use an agent when... |
|---|---|
| You know the steps ahead of time | The steps depend on what's found along the way |
| You need predictable cost and speed | Flexibility matters more than predictability |
| Each step is easy to describe | The task is open-ended |

You can also mix them: a workflow where one step hands off to the Chapter 02 agent loop.

## Make it yours

Every file has its example input at the bottom (`if __name__ == "__main__":`), and the parts meant to be changed are labelled in the comments: the routes, reviewers and criteria.

➡️ **Next: [04 — Multi-agent](../04-multi-agent/)**