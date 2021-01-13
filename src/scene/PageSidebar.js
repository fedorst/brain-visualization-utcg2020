import React, {Fragment} from "react";
import {Button, Checkbox, Grid, GridColumn, Header, Image, Segment} from "semantic-ui-react";
import {maxMoment, momentToMs} from "../helpers/Utility";
import {Slider} from "react-semantic-ui-range";
import ReactMarkdown from "react-markdown";

const sidebarDescription = "This visualization allows to you to interactively explore human brain data recorded with " +
    "deep intracranial probes (electrodes, implanted inside test subjects' brains as shown on the x-ray image below) " +
    "across 100 human subjects.\n";
const sidebarProgressTimeDescription = "As you progress through time (using the \"Time\" slider) you will see how " +
    "how the activity changes, especially in response to a stimulus (an image) being shown at the 0 ms time mark.\n";
const sidebarCategoryDescription = "You can choose the shown stimulus image category, the neural reaction to which " +
    "you would like to explore:\n";
const sidebarPredictive = <ReactMarkdown
  linkTarget={"_blank"}
  className={"textAligned"}
>{"Multiple neural locations react to an image being " +
"shown, but it appears " +
"that only a small portion of them carries the information that is relevant to recognizing the object on the image " +
"*(for details, see Kuzovkin et al., \"[Identifying task-relevant spectral signatures of perceptual categorization " +
"in the human cortex](https://www.nature.com/articles/s41598-020-64243-6)\", Scientific Reports, 2020)*. We call " +
"such probes \"predictive\".\n"}</ReactMarkdown>;

const sidebarDCNNLayersDescription = <ReactMarkdown
  linkTarget={"_blank"}
  className={"textAligned"}
>{"In addition to time and opacity, the controls also allow you to assign the " +
"color of the probes based either on the increase (red) or decrease (blue) of the activity with respect to the " +
"baseline, or to set the colors based on an assignation of electrodes' activity to layers of a Deep Convolutional" +
" Neural Network *(lower layers in blue, higher in layers in red, for details, see Kuzovkin et al., \"[Activations " +
"of deep convolutional neural networks are aligned with gamma band activity of human visual " +
"cortex](https://www.nature.com/articles/s42003-018-0110-y)\", " +
"Communications Biology, 2018)*"}</ReactMarkdown>;

const creditsText = "Implemented by Fedor Stomakhin, Siim Parring and Hain Zuppur as a part of the Computer Graphics " +
    "course at the Institute of Computer Science of University of Tartu, 2020";

const categories = [
  "Houses",
  "Faces",
  "Animals",
  "Scenery",
  "Tools",
  "Pseudoword",
  "Characters",
  "Noise",
];

const categoryDropdownOptions = categories.map((cat, i) => {
  return {key: cat, text: cat, value: i.toString()};// content: contentElement(colors[i], cat)};
});

const SubCategorySelectSettings = (props) => {
  const {hooks, displaySettings, active} = props;
  return (
    <Fragment>
      <Checkbox
        style={{
          width: "100%",
          paddingBottom: "2rem",
          paddingLeft: "1rem",
          textAlign: "left",
        }}
        toggle
        label='Sub-select stimulus image category'
        onChange={hooks.subSelectImg}
        checked={displaySettings.subSelectImgChecked}
      />
      {active &&
        <Grid columns={4} style={{margin: "0.5rem"}}>
          {categoryDropdownOptions.map(({key, text, value}) =>
            <GridColumn
              key={key}
              width={4}
              style={{
                padding: "0rem",
              }}>
              <Button
                style={{padding: "0rem"}}
                fluid
                positive={displaySettings.subSelectImage === value}
                onClick={() => hooks.toggleSubSelectImg(value)}>
                <Image
                  src={`sprites/${text}.jpg`}/>
                <p>{text}</p>
              </Button>
            </GridColumn>)}
        </Grid>
      }
      {active && sidebarPredictive}
      {active &&
        <Checkbox
          toggle
          label="Show only predictive probes"
          onChange={hooks.togglePredictiveProbes}
          checked={displaySettings.onlyPredictiveProbes}
        />
      }
    </Fragment>
  );
};

export const PageSidebar = (props) => {
  let {displaySettings, playing, hooks, updateMoment, slider, brainOpacity} = props;

  if (displaySettings && hooks) {
    return <Fragment>
      <p style={{"textAlign": "left"}}>{sidebarDescription}</p>
      <img src={"xray.png"} width={"100%"} alt={"X-ray image of electrodes within a brain"}/>
      <p style={{"textAlign": "left"}}>{sidebarProgressTimeDescription}</p>
      <p style={{"textAlign": "left"}}>{sidebarCategoryDescription}</p>
      <Segment vertical>
        <SubCategorySelectSettings
          active={displaySettings.subSelectImgChecked}
          hooks={hooks}
          displaySettings={displaySettings}/>
      </Segment>
      {sidebarDCNNLayersDescription}
      {/*
        <Segment vertical>
          <Checkbox
            radio
            label="Baseline-normalized LFP responses"
            style={{
              paddingLeft: "1rem",
              width: "100%",
              textAlign: "left",
            }}
            onChange={hooks.toggleHighGammaFrq}
            checked={!displaySettings.highGammaFrq}
          />
          <Checkbox
            radio
            label="Baseline-normalized neural responses in high gamma"
            style={{
              paddingLeft: "1rem",
              width: "100%",
              textAlign: "left",
            }}
            onChange={hooks.toggleHighGammaFrq}
            checked={displaySettings.highGammaFrq}
          />
        </Segment>
      */}
      <Segment vertical>
        <Checkbox
          radio
          label="Color-code in accordance with the change in activity"
          style={{
            paddingLeft: "1rem",
            width: "100%",
            textAlign: "left",
          }}
          onChange={hooks.toggleColorCode}
          checked={!displaySettings.colorCoded}
        />
        <Checkbox
          radio
          label="Color-code the probes to reflect complexity of visual representations based on DCNN mapping"
          style={{
            paddingLeft: "1rem",
            width: "100%",
            textAlign: "left",
          }}
          onChange={hooks.toggleColorCode}
          checked={displaySettings.colorCoded}
        />
      </Segment>
      <Segment vertical>
        <Header>Time: {momentToMs(displaySettings.moment)}</Header>
        <Slider
          /* eslint-disable no-unused-vars */
          ref={(r) => slider = r}
          value={displaySettings.moment}
          discrete
          color="red"
          settings={{
            start: 0,
            min: 0,
            max: maxMoment,
            step: 1,
            onChange: updateMoment,
          }}
        />
        <Button.Group>
          <Button
            disabled={playing}
            labelPosition='left'
            icon='left chevron'
            content='Previous'
            onClick={hooks.timeBackward} />
          <Button
            icon={playing ? "pause" : "play"}
            content={playing ? "Pause" : "Play"}
            onClick={hooks.togglePlayPause}/>
          <Button
            icon='undo'
            content='Reset'
            onClick={() => {
              hooks.resetTime();
              slider.setState({position: 0}); // visual hack, otherwise slider won't reset properly
            }}/>
          <Button
            disabled={playing}
            labelPosition='right'
            icon='right chevron'
            content='Next'
            onClick={hooks.timeForward} />
        </Button.Group>
      </Segment>
      <Segment vertical>
        <Header>Brain opacity: {brainOpacity}</Header>
        <Slider
          value={brainOpacity}
          color="red"
          settings={{
            start: 0.4,
            min: 0.0,
            max: 1.0,
            step: 0.025,
            onChange: hooks.updateBrainOpacity,
          }}
        />
      </Segment>
      <br/>
      <p style={{"textAlign": "left"}}>{creditsText}</p>
    </Fragment>;
  } else {
    return <div/>;
  }
};
