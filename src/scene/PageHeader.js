import {Header} from "semantic-ui-react";
import React, {Fragment} from "react";

export const PageHeader = (props) => {
  return <Fragment>
    <Header
      as="h1"
      content="Human Brain Activity"
      floated="left"
      subheader="Recorded with implanted intracranial electrodes while looking at natural images"
      style={{margin: "10px"}}/>
    <a href={"http://www.neuro.cs.ut.ee"} target="_blank" rel="noreferrer noopener">
      <img src={"CompNeurosciLogo.png"} height={80} alt={"UT Computational Neuroscience department logo"}/>
    </a>
    <a href={"http://www.ut.ee"} target="_blank" rel="noreferrer noopener">
      <img src={"UOTLogo.png"} height={80} alt={"Tartu University logo"}/>
    </a>
  </Fragment>;
};
